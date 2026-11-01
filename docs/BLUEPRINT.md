# Ventidoc — Product & Technical Blueprint

Nov 1, 2026 · @Jite J

## Overview

Ventidoc is a multi-tenant, subscription-based inventory and business-operations platform for shop owners, with web (Next.js on Vercel) and mobile/tablet (Flutter) clients sharing one API and one PostgreSQL database. It earns money only from subscriptions; shop owners take payments into their own business accounts and record them in Ventidoc.

The product has three kinds of users, each with a separate login space and permissions:

| User type      | Who they are                                                                           | What they do                                                                         |
| -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Platform staff | You and your team                                                                      | Run Ventidoc: branding, CMS pages, plans, tenants, support, moderation, billing      |
| Tenant users   | A shop owner (the tenant) plus their managers, cashiers, store keepers and other staff | Run one or more shops: inventory, sales, HR, finance, network borrowing, marketplace |
| Public users   | Job seekers, marketplace visitors, customers                                           | Apply for jobs, browse marketplace listings, receive receipts and emails             |

The central idea: one **business account (tenant)** owns many **shops (locations)**. Everything a tenant creates belongs to that tenant and is invisible to every other tenant, except what the owner deliberately publishes to the Ventidoc Network (borrowing) or the Marketplace.

## Architecture & tech stack

Use Next.js for the web app and a versioned REST API (`/api/v1/...`), and have Flutter call that same API. Both clients must go through one API layer so permission and tenant checks live in exactly one place.

&#91;embedded content: Ventidoc architecture · clients, API checks, data and services\]

PostgreSQL with Row-Level Security is the last line of defence: even if an API check is missed, the database refuses rows from another tenant.

| Layer                  | Recommendation                                                                            | Why                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Web app + API          | Next.js (App Router, TypeScript) on Vercel                                                | One codebase for UI and backend; Route Handlers serve both web and Flutter         |
| Mobile / tablet        | Flutter (iOS, Android), tablet-first layouts                                              | One codebase; adaptive layouts for phone vs tablet                                 |
| Database               | PostgreSQL (Neon or Supabase, with connection pooling)                                    | Row-Level Security for tenant isolation, JSONB for dynamic settings                |
| ORM                    | Drizzle ORM                                                                               | Typed SQL, works well with RLS and serverless                                      |
| Validation / contract  | Zod schemas, exported to an OpenAPI spec                                                  | Generate the Dart API client from OpenAPI so Flutter never drifts from the backend |
| Auth                   | Better Auth (or Auth.js) with access + refresh tokens, 2FA                                | Works for cookies on web and bearer tokens on mobile                               |
| File storage           | Cloudflare R2 or S3 (private buckets, signed URLs)                                        | Logos, product images, receipts, CVs, incident photos                              |
| Background jobs & cron | Inngest, Trigger.dev or Upstash QStash + Vercel Cron                                      | Vercel functions time out; payroll runs, reports and low-stock checks run as jobs  |
| Cache / rate limiting  | Upstash Redis                                                                             | Per-user and per-tenant rate limits, plan/feature cache                            |
| Email                  | SMTP via Nodemailer (default) with Resend as a switchable provider; React Email templates | Tenant-branded receipts and notifications                                          |
| Push notifications     | Firebase Cloud Messaging (covers iOS via APNs)                                            | In-app and push for mobile                                                         |
| Realtime               | Pusher, Ably or Supabase Realtime                                                         | Live stock updates, borrow requests, chat                                          |
| Subscription billing   | Paystack (Nigeria) + Stripe (international)                                               | Only money Ventidoc ever touches                                                   |
| Monitoring             | Sentry + Vercel Analytics + audit logs in Postgres                                        | Errors, performance, security trail                                                |

### Caveats to plan for early

- **Server Actions are web-only.** Flutter cannot call them, so put business logic in a shared service layer and expose it through Route Handlers; Server Actions can call the same services.
- **Serverless + Postgres needs pooling.** Use the pooled connection string (Neon or Supabase pooler / PgBouncer), or you will run out of connections under load.
- **Offline mode for sales.** Shops lose internet. The Flutter app should keep a local database (Drift or Isar) and a sync queue so sales and stock counts keep working and sync later, with conflict rules on the server.
- **App Store rules on subscriptions.** Selling the subscription inside the iOS/Android app may require in-app purchase and a 15–30% fee. The common approach for B2B tools is: sign up and pay on the web, log in on mobile. Check Apple and Google's current guidelines before launch.
- **API versioning.** Old mobile app versions stay installed for months, so never break `/api/v1`; add `/api/v2` and force-update only when necessary.

## Multi-tenancy & data isolation

Use a shared database with a `tenant_id` on every tenant-owned row, enforced by PostgreSQL Row-Level Security (RLS) as a second wall behind your application checks. If a developer forgets a `WHERE tenant_id = ...`, RLS still returns zero rows from other tenants instead of leaking them.

### The layers of defence

1. **Authentication** identifies the user and their active tenant (stored in the session/token, never taken from the request body or URL alone).
2. **Tenant context middleware** loads the user's membership for that tenant and rejects the request if none exists.
3. **Permission check (RBAC)** confirms the user's role allows this action, and on which shops.
4. **Scoped repository layer**: every query function requires a `ctx` object (`tenantId`, `userId`, `shopIds`) and adds the filters automatically. Raw queries outside this layer are banned by lint rules and code review.
5. **PostgreSQL RLS**: each request runs in a transaction that sets `app.tenant_id`; policies like `USING (tenant_id = current_setting('app.tenant_id')::uuid)` block anything else. The app connects as a role that cannot bypass RLS; only migrations use the owner role.
6. **Storage isolation**: files are stored under `tenants/{tenantId}/...` in private buckets and served only through short-lived signed URLs issued after a permission check.
7. **Cache and search isolation**: every cache key and search index entry includes the tenant ID.

### Rules for shared spaces

The Network, Marketplace and Jobs portal are the only places data crosses tenants, so they never read tenant tables directly:

- Owners **publish** a copy or a limited projection (e.g. product name, photo, price, availability band) into a separate `public_listings` or `network_listings` table. Cost prices, suppliers, staff and finance never leave the tenant.
- Cross-tenant transactions (borrow requests, enquiries) live in their own tables with both tenant IDs, and RLS allows each side to see only its own half.
- Job seekers own their profile; a tenant sees an applicant only after the applicant applies or makes the profile visible.

### Use unguessable IDs

Use UUIDv7 for all primary keys, never sequential integers in URLs. Still check ownership on every request: an unguessable ID is not a permission check (this bug class is called IDOR and is the most common cause of tenant data leaks).

### Test it

Write automated tests that create two tenants and try to read, update and delete each other's data through every API endpoint. Run them on every pull request.

## RBAC (roles and permissions)

Build two separate permission systems, platform and tenant, using the same model: **permissions** are fixed strings in code, **roles** are editable bundles of permissions, and **assignments** link a user to a role with a scope.

### Permission format

Use `module.resource.action`, for example `inventory.product.create`, `hr.payroll.approve`, `finance.report.view`, `network.borrow.request`, `marketplace.listing.publish`. Keep the full list in one code file so UI menus, API guards and the role editor all read from it.

### Platform roles (your team)

| Role          | Can do                                                        |
| ------------- | ------------------------------------------------------------- |
| Super admin   | Everything, including managing other admins and plans         |
| Content admin | Branding, CMS pages, images, email templates                  |
| Billing admin | Plans, coupons, subscriptions, invoices, refunds              |
| Support agent | View tenants, impersonate with consent (logged), reset access |
| Moderator     | Review marketplace listings, job posts, reports and disputes  |

Super admin can create more platform roles from the same permission list.

### Tenant roles (shop owner's team)

Ship default roles: **Owner**, **Business manager** (all shops), **Shop manager**, **Cashier/Sales rep**, **Store keeper**, **Accountant**, **HR officer**, **Auditor** (read-only). The owner can clone, edit or create custom roles.

Each assignment has a scope:

- **All shops** (e.g. accountant, business manager)
- **Specific shops** (e.g. a shop manager in Lekki only sees Lekki)

### Field-level visibility

Some data must be hidden even inside a screen the user can open. Add permission flags such as `inventory.product.view_cost_price`, `hr.employee.view_salary`, `finance.view_profit`. The API removes those fields from responses; the UI just hides empty fields. Never rely on the UI alone.

### Safety rules

- Only the Owner can change billing, delete the business or transfer ownership.
- Users cannot grant permissions they do not hold themselves.
- Every role change and permission check failure is written to the audit log.
- Plan limits sit above roles: if the plan does not include a module, no role can unlock it.

## Platform admin & dynamic CMS

Everything a visitor or user sees about the Ventidoc brand should come from the database, edited in the admin panel, and cached. Nothing brand-related should be hard-coded.

### What the admin controls

| Area                           | Editable from admin                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand                          | App name, logo (light/dark), favicon, app icon reference, tagline, support email/phone, social links                                                                          |
| Theme                          | Primary, secondary, accent, success/warning/danger colours, font family, corner radius, light/dark defaults                                                                   |
| Pages                          | Landing page, pricing, features, about, FAQ, terms, privacy, help center built from reusable blocks (hero, feature grid, testimonials, pricing table, CTA, image + text, FAQ) |
| Media library                  | Upload, crop and reuse images across pages and emails                                                                                                                         |
| Plans                          | Names, prices per currency, billing cycles, limits, included modules, trial length                                                                                            |
| Feature flags                  | Turn modules on/off globally, per plan, or for specific tenants (beta testing)                                                                                                |
| Email & notification templates | Default subject/body per event, with variables like `{{shop_name}}`                                                                                                           |
| Categories                     | Business categories (Tech, Fashion, Pharmacy, Groceries...) used by Network and Marketplace                                                                                   |
| Moderation                     | Listings, job posts, reports, disputes, banned words                                                                                                                          |
| Tenants                        | View, suspend, extend trial, change plan, impersonate (logged)                                                                                                                |
| Announcements                  | Banners and in-app messages to all or selected tenants                                                                                                                        |
| System settings                | Currencies, tax defaults, maintenance mode, minimum mobile app version                                                                                                        |

### How it works technically

- Store brand and theme as a JSON settings record; the Next.js layout reads it and injects CSS variables. Flutter fetches `/api/v1/config` at launch and builds its `ThemeData` from the same values, caching it for offline use.
- Store pages as JSON block lists; one renderer component per block type on web. Use ISR/`revalidateTag` so edits appear instantly without a redeploy.
- Keep a draft/published version and history for every page so admins can preview and roll back.
- The App Store/Play Store app name and icon cannot change remotely; only in-app branding can. Changing those needs a new store release.

## Subscriptions & feature gating

Plans are data, not code: each plan is a record of limits and module switches that the admin edits, and the backend checks them on every relevant action.

### Example plan structure (all values editable in admin)

| Limit / module              | Starter | Growth         | Business  | Enterprise           |
| --------------------------- | ------- | -------------- | --------- | -------------------- |
| Shops                       | 1       | 3              | 10        | Custom               |
| Staff accounts              | 5       | 25             | 100       | Custom               |
| Products (SKUs)             | 500     | 5,000          | Unlimited | Unlimited            |
| HR & payroll                | Basic   | Full           | Full      | Full                 |
| Network borrowing           | No      | Yes            | Yes       | Yes                  |
| Marketplace listings        | No      | 50             | 500       | Unlimited            |
| Custom branding & emails    | No      | Logo + colours | Full      | Full + custom domain |
| Advanced analytics & audits | No      | Basic          | Full      | Full                 |
| API access                  | No      | No             | Yes       | Yes                  |

### Rules

- **Entitlements service**: one function `can(tenant, feature)` and `limit(tenant, key)`, cached in Redis, used by API and returned to the clients so they can show locked features with an upgrade prompt.
- **Upgrades** apply immediately with prorated billing. **Downgrades** apply at period end; if the tenant has more shops than the new limit, they choose which shops to archive (read-only, never deleted).
- **Billing cycles**: monthly and yearly (with discount), per currency (NGN, USD, others as you grow).
- **Trials**: e.g. 14 days on Growth, no card required.
- **Failed payment**: retry, email reminders, a 7-day grace period, then read-only mode. Data is kept for a set period (e.g. 90 days) before deletion, with export available.
- **Coupons, referral credits and add-ons** (extra shop, extra staff pack, extra marketplace slots) let owners grow without jumping a whole plan.
- **Webhooks** from Paystack/Stripe update subscription status; verify signatures and make handlers idempotent.

## Inventory & sales

Stock should never be a single editable number. Every change is a row in a **stock movement ledger** (sale, purchase, return, adjustment, transfer, borrow out/in, damage, theft, count correction), and the current quantity is the sum. This gives you exact audit trails and makes theft and errors traceable.

### Products

- Products with variants (size, colour, storage), SKU, barcode/QR, unit of measure, categories, brands, images
- Cost price, selling price, wholesale price, tax class; price per shop if needed
- Serial/IMEI tracking (important for tech shops), batch and expiry tracking (pharmacy, food)
- Bundles/kits, and bulk import/export via CSV/Excel
- Barcode scanning with the phone camera in Flutter; label and barcode printing

### Stock

- Stock per shop, per variant, with reorder level and reorder quantity
- **Automatic reduction** when a sale is completed (inside the same database transaction as the sale)
- **Low-stock alerts**: in-app, push and email, plus a daily digest; suggested purchase orders
- Stock counts (full and cycle counts) with variance reports and manager approval
- Transfers between the owner's own shops: request → approve → dispatch → receive, with in-transit stock
- Suppliers and purchase orders, goods received notes, supplier returns

### Sales (POS)

- Fast POS screen designed for tablets, works offline
- Payment methods recorded: cash, transfer, POS terminal, split payment, credit (customer owes)
- Receipts: printed (Bluetooth thermal printers), emailed, WhatsApp/SMS link, PDF
- Returns and refunds linked to the original sale, restocking automatically
- Hold/park sales, quotations and invoices, layaway/deposits
- Shift open/close with cash count and over/short report per cashier

### Discounts & promotions

- Percentage or fixed amount, on item or cart
- Buy X get Y, bundle price, happy hour/date ranges, per shop or all shops
- Coupon codes, customer-group pricing, loyalty points
- Manager approval required above a set discount limit (by role)

### Customers

- Customer profiles, purchase history, credit balance and debt tracking, loyalty, notes
- Consent flags for marketing emails

## HR & staff

Each employee is a person record in the tenant, optionally linked to a login account, so you can track staff who never use the app (cleaners, security) and still pay them.

| Feature                     | What it includes                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employee records            | Personal details, next of kin, guarantor info, ID documents, bank details (encrypted), job title, shop(s), start date, contract type                            |
| Attendance                  | Clock in/out on the app with GPS geofence around the shop and optional selfie, or a shared shop tablet with PIN; late/absent reports; shift schedules and rotas |
| Leave                       | Leave types and yearly balances, request → approval flow, calendar of who is away per shop                                                                      |
| Payroll                     | Base salary, allowances, commission on sales, overtime, deductions (lateness, loans, advances, shortages), tax/pension fields; monthly payslips as PDF          |
| Salary payment              | Ventidoc does not move money. The owner pays from their bank, then marks each payslip paid with reference and optional proof upload                             |
| Loans & advances            | Track salary advances and automatic deductions until repaid                                                                                                     |
| Performance                 | Sales per staff, targets, commission, reviews and notes                                                                                                         |
| Incident & accident reports | Who, where, when, description, photos, witnesses, injury severity, actions taken, follow-up status                                                              |
| Theft & loss reports        | Linked to the affected stock (creates a theft/loss stock movement), suspected staff, police report reference, investigation status, recovered value             |
| Disciplinary records        | Queries, warnings, suspensions, with acknowledgement by the employee                                                                                            |
| Offboarding                 | Exit date, handover checklist, final pay, account deactivated instantly across all devices                                                                      |
| Documents                   | Contracts, offer letters, policies with e-acknowledgement                                                                                                       |

Sensitive fields (salary, bank details, ID numbers, disciplinary notes) need their own permissions and are encrypted at the column level.

## Finance, payment recording & audits

Ventidoc records money; it never holds it. Customers pay the shop's own bank account, POS terminal or cash drawer, and staff record what happened. This keeps you out of payment-licensing regulation and away from customer funds.

### Recording payments

- Each shop sets its payment accounts (bank name, account name and number, POS terminals), shown on receipts and invoices.
- At checkout, the cashier picks the method and marks it **Pending** or **Confirmed**, with optional transfer reference and screenshot.
- Owners can require that transfers above an amount are confirmed by a manager or accountant before the sale is final.
- A **reconciliation screen** lists recorded transfers per day so the owner can tick them off against the bank statement; unmatched items are flagged.
- Optional later: bank statement CSV import to auto-match references.

### Finance

- Income (sales, other income) and expenses with categories, receipts and approvals
- Accounts receivable (customer debts) and payable (supplier bills), with ageing reports
- Cash drawer and petty cash per shop
- Profit & loss, cash flow, sales by shop/staff/product/category, gross margin, inventory valuation (FIFO or weighted average)
- Tax settings (VAT) and tax summary reports
- Budgets per shop and alerts when exceeded
- Export to Excel/PDF; later, integrations with accounting tools

### Audits

- **Audit log** of every create/update/delete: who, what, before/after values, when, device, IP. It is append-only and cannot be edited even by the owner.
- **Stock audits**: scheduled counts, variance by product and staff, write-off approval.
- **Cash audits**: shift over/short history per cashier.
- **Suspicious activity alerts**: many voids or refunds, large discounts, sales outside working hours, stock adjustments without reason, logins from new devices.

### Analytics

One dashboard per role: owners see all shops compared; shop managers see their shop. Include top/slow-moving products, dead stock, stock-out frequency, peak hours, staff leaderboard, sales trends and simple forecasts for reordering.

## Ventidoc Network (cross-owner borrowing)

The Network lets verified businesses in the same category request, borrow, lend or buy stock from each other, with both sides' records updated automatically. Because it involves trust between strangers, it needs verification, written terms and a clear trail.

### Who can join

- Opt-in per tenant (plan-gated). Owners choose which shops and which products are visible to the Network, and whether to show exact quantity or just "available".
- Businesses must be verified first: phone and email, business registration (CAC) or ID, shop address, optionally a manual review by your moderators.
- Owners can block specific businesses and set a credit limit per partner.

### Request flow

1. **Search**: a shop searches the Network by product, category and location, or posts a public "looking for" request.
2. **Request**: choose item, quantity, type (borrow and return, borrow and pay later, or buy outright), proposed price/fee, return date.
3. **Accept, counter or decline** by the lender.
4. **Agreement**: both owners confirm digital terms (items, condition, serial numbers, value, return date, penalties). This becomes a signed record.
5. **Dispatch & receive**: each side confirms with photos; stock moves out of the lender and into the borrower as **borrowed stock** (tracked separately, never counted as owned).
6. **Settle**: return of items, or payment recorded (by bank transfer between the two businesses, recorded and confirmed by the receiver).
7. **Close and rate**: both sides rate each other; ratings build a trust score.

Overdue items trigger reminders to both owners. Either party can open a **dispute**, which freezes the record and goes to your moderators with the full trail.

### Records

Each business sees a **partner ledger** per counterparty: items out, items in, amounts owed each way, history. Selling borrowed items is allowed only when the agreement type permits it, and then it converts automatically into a purchase owed to the lender.

Inside a single owner's business, borrowing between their own shops uses the simpler internal transfer flow (no agreement or ratings needed).

## Marketplace

The Marketplace is a public catalogue where shops on eligible plans choose which products to list; buyers contact or order from the shop, and payment goes directly to the shop's own account. Ventidoc stays a listing platform, not a seller.

- **Listing control**: a "Publish to Marketplace" toggle per product (and per shop), with a separate public price, description and photos. Listing slots are limited by plan.
- **Live stock sync**: the listing shows in stock / low / out of stock from the real inventory, so buyers do not order what is gone.
- **Shop storefront page**: logo, colours, about, locations, ratings, WhatsApp/phone, opening hours, all from the tenant's branding settings, at `ventidoc.com/s/shop-name`.
- **Buyer flow**: search by product, category and location; send an enquiry or an order request; the shop confirms availability and shares its payment details; the shop marks it paid when confirmed; stock reduces automatically. Pickup or delivery is arranged by the shop.
- **Order tracking** for buyers via a link or account; buyer reviews after completion.
- **Trust & safety**: only verified businesses can list, moderators review reports, banned categories (weapons, drugs, counterfeit), and fraud warnings telling buyers to pay only to the shop's verified business account.
- **Promoted listings / featured shops** later as an optional paid add-on (still a subscription-style fee, not a commission).
- **SEO**: server-rendered product and shop pages in Next.js with structured data, so listings show up in Google.

## Jobs portal

Job seekers get a free Ventidoc account separate from any business; when hired, the same person is linked to the employer's tenant as an employee, so onboarding takes one click.

### Job seeker side

- Profile: name, photo, location, roles wanted (sales rep, cashier, store keeper, manager...), experience, skills, education, CV upload, expected salary, availability
- Visibility setting: **open to all verified shops**, **only shops I apply to**, or **hidden**
- Browse and apply to job posts; track application status; receive interview invites and messages
- Verified badges later (phone, ID, previous Ventidoc employer reference)

### Business side

- Post jobs (role, shop, location, pay range, requirements) on eligible plans
- Search candidates who are open to all shops, with filters by role, location and experience
- Pipeline per job: Applied → Shortlisted → Interview → Offer → Hired / Rejected
- Send interview invites with date, time and address or video link; candidate accepts or reschedules
- **Hire**: creates the employee record from the profile and sends an invitation to join the business with the chosen role and shop

### Privacy for applicants

- Phone, email and CV are hidden until the person applies to that business or accepts its invite.
- Applicants can withdraw and delete their data at any time.
- When an employee leaves, the former employer keeps only the records required for HR and finance; references the employer gives are visible to the person (to avoid secret blacklisting).
- Rate-limit candidate searches and log them, to stop businesses scraping profiles.

## Notifications, emails & personalization

Use one notification service: every event (low stock, borrow request, leave request, payslip ready, subscription due) is published once, and each user's preferences decide whether it goes in-app, push, email or SMS/WhatsApp.

### Notification channels

| Channel                           | Used for                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| In-app inbox (web + app)          | Everything, with read/unread and links to the record                                |
| Push (FCM)                        | Urgent items: low stock, approvals needed, borrow requests, theft reports           |
| Email (SMTP, or Resend)           | Receipts, invoices, payslips, daily/weekly summaries, account security              |
| SMS / WhatsApp (Termii or Twilio) | OTPs, customer receipts, overdue reminders (paid add-on, since you pay per message) |

Users choose per category and per channel; owners can make some alerts mandatory for certain roles.

### Tenant personalization (within plan limits)

- Business name, logo, colours and theme mode applied to their dashboard, receipts, invoices, emails and storefront
- Receipt layout: header, footer message, show/hide fields, paper size (58mm/80mm/A4), logo on receipt
- Custom email templates for customers (receipt, thank-you, order ready, debt reminder, promotions) with a simple editor and variables
- Custom sender name, and on top plans a custom email domain (verified via DNS) or the tenant's own SMTP server
- Dashboard layout: choose and arrange widgets
- Custom fields on products, customers and employees
- Language (English first; plan for Yoruba, Igbo, Hausa, French), currency, date format, timezone, tax rules
- Custom domain for the storefront on the Enterprise plan

## Things you missed

These are additions that most inventory products in this space eventually need; the most important ones are offline mode, onboarding and data export.

| Feature                         | Why it matters                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Offline-first POS and sync      | Internet and power outages are common; sales must never stop                                                      |
| Guided onboarding               | Setup wizard: business info, first shop, import products from Excel, invite staff, first sale in under 10 minutes |
| Data export & backup            | Owners can export all their data (CSV/Excel/PDF); builds trust and is required by data protection law             |
| Multi-currency & multi-language | Needed once you go beyond one country                                                                             |
| Device management               | Register shop devices, log out a lost phone remotely, restrict cashier logins to shop devices                     |
| Approval workflows              | Configurable approvals for refunds, discounts, stock adjustments, expenses, transfers                             |
| Tasks & checklists              | Opening/closing checklists per shop, tasks assigned to staff                                                      |
| Internal chat / announcements   | Owner-to-staff messages per shop, so business talk stays off personal WhatsApp                                    |
| Delivery & logistics            | Riders/dispatch, delivery status, proof of delivery, delivery fees, transfers in transit between shops            |
| Supplier portal                 | Suppliers receive purchase orders by link and confirm them                                                        |
| Warranty & repairs              | Tech shops: track warranties by serial number, repair tickets and status                                          |
| Scheduled reports               | Daily sales summary emailed or pushed to the owner at closing time                                                |
| Help center & in-app support    | Searchable help articles from the CMS, support tickets/chat, video tutorials                                      |
| Referral program                | Owners earn credit for referring other businesses                                                                 |
| Public API & webhooks           | For larger customers and integrations (accounting, e-commerce sites)                                              |
| AI assistant (later)            | "How did Ikeja shop do this week?", reorder suggestions, anomaly detection on theft                               |
| Accessibility                   | Large touch targets, readable fonts, screen-reader labels, works on low-end Android phones                        |
| Status page & changelog         | Transparency during outages; announce new features                                                                |
| Legal pages & consent           | Terms, privacy policy, cookie consent, data processing agreement for businesses                                   |

## Core data model

Every tenant-owned table carries `tenant_id` (and `shop_id` where relevant), `created_at`, `updated_at`, `created_by` and a soft-delete `deleted_at`. Money is stored as integers in the smallest unit (kobo/cents) with a currency code, never as floats.

| Group       | Key tables                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platform    | `platform_settings`, `cms_pages`, `media`, `plans`, `plan_features`, `feature_flags`, `categories`, `platform_users`, `platform_roles`                                                           |
| Identity    | `users` (one per human, across tenants), `sessions`, `devices`, `mfa_factors`                                                                                                                    |
| Tenancy     | `tenants` (business), `shops`, `tenant_members` (user ↔ tenant), `roles`, `role_permissions`, `member_roles` (with shop scope)                                                                   |
| Billing     | `subscriptions`, `subscription_items` (add-ons), `invoices`, `payment_events` (webhooks), `coupons`                                                                                              |
| Catalogue   | `products`, `product_variants`, `product_images`, `brands`, `product_categories`, `price_lists`, `serial_numbers`, `batches`                                                                     |
| Inventory   | `stock_movements` (the ledger), `stock_levels` (cached totals per shop/variant), `stock_counts`, `transfers`, `transfer_items`, `suppliers`, `purchase_orders`                                   |
| Sales       | `customers`, `sales`, `sale_items`, `sale_payments`, `returns`, `discounts`, `coupons_tenant`, `shifts`, `receipts`                                                                              |
| Finance     | `accounts` (bank/cash/POS), `expenses`, `income`, `debts`, `reconciliations`                                                                                                                     |
| HR          | `employees`, `attendance_logs`, `shifts_schedule`, `leave_types`, `leave_requests`, `payroll_runs`, `payslips`, `salary_payments`, `loans`, `incidents`, `theft_reports`, `disciplinary_records` |
| Network     | `network_profiles`, `network_listings`, `borrow_requests`, `borrow_agreements`, `borrow_items`, `partner_ledgers`, `ratings`, `disputes`                                                         |
| Marketplace | `storefronts`, `public_listings`, `enquiries`, `order_requests`, `reviews`                                                                                                                       |
| Jobs        | `candidate_profiles`, `job_posts`, `applications`, `interviews`, `offers`                                                                                                                        |
| Comms       | `notifications`, `notification_preferences`, `email_templates`, `push_tokens`, `messages`                                                                                                        |
| Security    | `audit_logs` (append-only), `login_events`, `api_keys`                                                                                                                                           |

A user can belong to several tenants (e.g. a manager who also has their own small shop) and switches between them; each tenant membership has its own roles.

## Security & privacy checklist

Treat this as a launch gate: Ventidoc holds staff salaries, bank details and business finances, so a leak would end trust in the product.

- [ ] Tenant isolation: scoped repository layer + PostgreSQL RLS on every tenant table, with cross-tenant tests in CI
- [ ] Passwords hashed with Argon2id; 2FA (authenticator app) required for owners and platform admins, optional for staff
- [ ] Short-lived access tokens (about 15 min) + rotating refresh tokens; revoke all sessions on password change or staff removal
- [ ] Mobile tokens in Keychain/Keystore (`flutter_secure_storage`); optional app PIN/biometric lock
- [ ] Rate limiting on login, OTP, search and public endpoints; account lockout and bot protection (Cloudflare Turnstile)
- [ ] Input validation with Zod on every endpoint; parameterised queries only (the ORM does this)
- [ ] Column-level encryption for bank details, ID numbers and salaries; keys in a secrets manager, not in code
- [ ] Private file storage with signed URLs; virus scanning and type/size checks on uploads
- [ ] HTTPS everywhere, HSTS, secure cookies, CSRF protection, strict Content Security Policy
- [ ] Append-only audit log; alerts on unusual activity; platform-admin impersonation requires reason and is logged and shown to the tenant
- [ ] Least-privilege database roles; production access limited to a few people with 2FA
- [ ] Daily automated backups with point-in-time recovery, and a tested restore
- [ ] Dependency scanning (Dependabot), secret scanning, and a penetration test before public launch
- [ ] Compliance with Nigeria's Data Protection Act 2023 (NDPA): privacy policy, consent, data export and deletion requests, breach notification plan; GDPR if you serve the EU
- [ ] Data retention rules: what is deleted when a tenant cancels, a job seeker deletes their account, or an employee leaves

## Build stages & repo structure

Build in 15 small stages, each one built and tested by Claude Code and closed only when every test passes. A bug can then always be traced to the one stage that introduced it.

### Rules for every stage

1. Claude Code writes tests in the same stage as the feature (unit + integration; end-to-end where there is UI).
2. The **whole** test suite, lint and type-check must pass before the stage closes, not just the new tests.
3. Small commits on a branch `stage-N-name`, merged to `main` and tagged `stage-N` when green, so you can always roll back to a known-good point.
4. Claude Code updates `docs/PROGRESS.md` with what was built, decisions made, known issues and how to run it.
5. You paste the stage report (test output + summary) back here; I review it and give you the next prompt or a fix prompt.
6. The cross-tenant isolation test suite from Stage 4 grows with every later stage: each new endpoint gets an "another tenant cannot access this" test.

### Stages

| #   | Stage                    | Build                                                                                                                                                                           | Test & exit gate                                                                                       |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0   | Repo & tooling           | Turborepo + pnpm monorepo, Next.js app, TypeScript strict, ESLint, Prettier, Vitest, Playwright, local Postgres + Mailpit via Docker Compose, env validation, GitHub Actions CI | CI green; app boots; `pnpm test` runs a sample test                                                    |
| 1   | Database foundation      | Drizzle setup, migrations, base tables (users, tenants, shops, members), app DB role without RLS bypass, `withTenant()` transaction helper, RLS policies                        | Tests prove tenant A cannot read/write tenant B rows directly in Postgres, even without a WHERE clause |
| 2   | Email service            | Provider interface with SMTP (Nodemailer) as default and Resend adapter, chosen by env; React Email templates; send log; retries                                                | Emails captured in Mailpit; provider switch tested; failures logged, never crash requests              |
| 3   | Authentication           | Sign up, email verification, login, logout, password reset, 2FA, cookie sessions for web, bearer + refresh tokens for mobile, rate limits                                       | Auth integration tests incl. expired/reused tokens, lockout, 2FA                                       |
| 4   | Tenancy & RBAC           | Create business, shops, invite staff, roles + permissions, shop scope, API middleware chain (auth → tenant → RBAC), `/api/v1` + OpenAPI                                         | Permission matrix tests; cross-tenant API test harness created                                         |
| 5   | Platform admin & CMS     | Separate admin login, branding/theme settings, `/api/v1/config`, CMS block pages, media uploads (private storage, signed URLs)                                                  | Admin cannot be reached with tenant login; theme change shows without redeploy                         |
| 6   | Plans & billing          | Plans, entitlements `can()`/`limit()`, Paystack (test mode) checkout, webhooks, trials, grace and read-only mode                                                                | Webhook replay + bad signature tests; shop/staff limits enforced                                       |
| 7   | Catalogue & stock ledger | Products, variants, categories, images, stock movements, stock levels, transfers between own shops, CSV import                                                                  | Ledger totals always equal movements; concurrent sale of last item cannot go negative                  |
| 8   | Sales & POS (web)        | POS, payments recording, receipts (print/email/PDF), returns, shifts, low-stock alerts, in-app notifications                                                                    | End-to-end sale reduces stock and sends receipt; refund restocks                                       |
| 9   | Flutter foundation       | App shell, generated Dart client, login, theme from `/config`, tablet + phone layouts, POS with offline queue and sync, push (FCM)                                              | Widget tests; offline sale syncs correctly; conflicts handled                                          |
| 10  | Operations & finance     | Suppliers, purchase orders, stock counts, customers and debts, discounts/coupons, expenses, P&L, reconciliation, audit log views, dashboards                                    | Report numbers match seeded test data exactly                                                          |
| 11  | HR                       | Employees, attendance with geofence, leave, payroll, payslips, salary-paid recording, incidents, theft reports                                                                  | Payroll calculations tested with fixed examples; salary fields hidden without permission               |
| 12  | Ventidoc Network         | Verification, network listings, borrow requests, agreements, borrowed stock, partner ledgers, ratings, disputes                                                                 | Both sides' ledgers always agree; private fields never exposed                                         |
| 13  | Marketplace & Jobs       | Storefronts, public listings, enquiries/order requests, candidate profiles, job posts, hiring pipeline, hire → employee                                                         | Public pages show only published fields; applicant contact hidden until applied                        |
| 14  | Hardening & launch       | Load testing, security review, backup/restore drill, monitoring alerts, NDPA pages and data export/deletion                                                                     | Restore tested; no high-severity findings open                                                         |

### Suggested repo structure

Your GitHub repo `ventidoc` is currently empty, so this is a clean starting point (Turborepo + pnpm):

```
ventidoc/
  apps/
    web/            # Next.js: marketing site, dashboard, admin, /api/v1
    mobile/         # Flutter app (phone + tablet)
  packages/
    db/             # Drizzle schema, migrations, RLS policies, seed data
    core/           # business logic services (inventory, sales, hr...) used by API
    auth/           # auth config, session + token helpers
    permissions/    # permission list, roles, can() checks, plan entitlements
    validation/     # Zod schemas -> OpenAPI spec -> generated Dart client
    emails/         # React Email templates
    ui/             # shared web components and theme tokens
  docs/             # architecture decisions, API docs
  .github/workflows # CI: lint, type-check, tests, tenant-isolation tests
```

Inside `apps/web`, keep separate route groups: `(marketing)`, `(app)` for tenants, `(admin)` for platform staff, `(jobs)`, `(market)`. Serve the admin on its own subdomain (e.g. `admin.ventidoc.com`) with its own login, never mixed with tenant logins.
