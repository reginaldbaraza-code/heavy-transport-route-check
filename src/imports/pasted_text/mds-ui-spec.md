Design a modern, enterprise-grade web application UI for the Mobility Data Space (MDS), a secure, non-profit digital marketplace and data-sharing ecosystem for mobility data in Germany.

Product context

The Mobility Data Space connects organizations that provide mobility data with organizations that need or consume mobility data.

Typical data providers include:

BMW

Mercedes-Benz

Public transport operators

Cities and municipalities

Traffic infrastructure providers

Mobility companies

Typical data consumers include:

App developers

Researchers

Universities

City planners

Government organizations

Mobility startups

Automotive companies

MDS is operated by DRM Datenraum Mobilität GmbH.

A core principle is data sovereignty: MDS should not feel like a traditional centralized data warehouse. Data remains with the provider and is only made accessible according to agreed contracts and permissions.

The platform must communicate:

Trust

Security

Transparency

Data sovereignty

Professionalism

European/German public-sector credibility

Ease of use

MDS also connects with Mobilithek, the German federal platform for mobility data.

Design goal

Redesign the existing MDS experience to make it significantly more user-friendly, intuitive and modern, while maintaining the seriousness expected from an enterprise/public-sector data platform.

The interface should feel like a combination of:

A modern B2B SaaS platform

A sophisticated data marketplace

A trusted European public-sector platform

Avoid making it look like a generic government website or an overly futuristic "AI dashboard".

Prioritize clarity, information hierarchy, discoverability and simple workflows.

Visual direction

Create a clean, premium and restrained visual system.

Use:

Light background

White cards and surfaces

Deep navy / dark blue as the primary brand color

Blue/teal accents for interactive elements

Subtle green for verified/success states

Amber/orange only for warnings

Dark charcoal text

Very subtle borders and shadows

Generous whitespace

Modern sans-serif typography

Rounded corners, but not excessively playful

The design should feel distinctly European and professional.

Avoid:

Excessive gradients

Neon colors

Glassmorphism

Excessive animations

Cryptocurrency/Web3 aesthetics

Overly technical developer-tool styling

Huge decorative illustrations

Use icons sparingly and consistently.

Create the following UI screens
1. Main dashboard / Home

Create a personalized MDS dashboard after login.

Header:

MDS logo

Global search

Notifications

Help

User profile / organization switcher

Left navigation:

Home

Discover Data

My Data

My Requests

Contracts

Organizations

Activity

Favorites

Settings

Main dashboard:

Welcome section:
"Good morning, [Organization Name]"

Show a concise overview of the user's activity.

Include KPI cards:

Active data contracts

Available datasets

Pending requests

Data subscriptions

Then create a section called:

"Recommended for you"

Show 3–4 datasets based on the user's organization/interests.

Example:

Real-time traffic flow

Public transport disruptions

EV charging availability

Parking availability

Each dataset card should display:

Dataset name

Provider

Category

Location

Update frequency

Data format

Availability status

Trust/verification indicator

CTA: "View dataset"

Add a "Recent activity" section showing events such as:

Contract approved

Dataset updated

Access request submitted

New organization connection

2. Data Marketplace / Discover Data

This should be one of the most important screens.

Create a marketplace where users can discover mobility datasets.

Top area:
"Discover mobility data"

Subtitle explaining that users can search and access trusted mobility datasets.

Large search bar:
"Search datasets, providers, locations..."

Add intelligent filters:

Data type

Mobility mode

Location

Provider

Update frequency

Data format

Access type

License

Real-time / historical

Public / private

Availability

Verified provider

Example categories:

Traffic

Public Transport

Parking

EV Charging

Shared Mobility

Road Infrastructure

Weather

Vehicle Data

Logistics

Urban Mobility

Include a map/list toggle.

List view should show high-quality dataset cards.

Each card should include:
Dataset title
Provider
Short description
Coverage
Freshness
Update frequency
Data type
Access model
Verification status

Example dataset:

"Real-Time Traffic Flow — Munich"

Provider: City of Munich
Updated: 30 sec ago
Coverage: Munich metropolitan area
Format: API / JSON
Access: Contract required
Status: ● Available

CTA:
"View dataset"

Also include:
"Save"
"Compare"

Make comparison a useful feature: users can select multiple datasets and compare their coverage, freshness, formats, licensing and access conditions.

3. Dataset detail page

Create a highly polished dataset detail page.

Header:
Dataset name
Provider
Verification badge
Favorite button
Share button

Example:

"Real-Time Traffic Flow — Munich"

Show a clear summary:

Provider:
City of Munich

Coverage:
Munich metropolitan area

Last updated:
30 seconds ago

Update frequency:
Every 30 seconds

Data format:
JSON / API

Access:
Contract required

Then create tabs:

Overview
Data Preview
Coverage
Access & License
Usage
Documentation

Overview should contain:

Dataset description

What the data contains

How frequently it updates

Geographic coverage

Data quality indicators

Historical availability

Include a visual map showing geographic coverage.

Include a small sample data preview table.

Create a prominent section:

"Access this dataset"

Explain the access process in simple language:

Review access conditions

Submit request

Provider reviews request

Contract is established

Data access becomes available

CTA:
"Request access"

Important UX feature:
Clearly distinguish between discovering data and actually receiving access.

The interface should make MDS's data sovereignty model understandable without requiring technical knowledge.

4. Access request flow

Design a simple multi-step request flow.

Step indicator:

Dataset

Intended use

Organization

Review

Submit

Page title:
"Request access to Real-Time Traffic Flow"

Ask:

"What will you use this data for?"

Provide selectable options:

Research

Product development

Urban planning

Commercial application

Public service

Internal analysis

Other

Then:
"Describe your intended use"

Text area.

Then:
"How long do you need access?"

Options:

30 days

6 months

1 year

Ongoing

Then show a transparent summary of:

Data provider

Dataset

Intended use

Access conditions

License

Data retention rules

Expected costs, if applicable

CTA:
"Submit access request"

5. Contracts

Create a dedicated contract management screen.

Title:
"Contracts"

Tabs:

Active

Pending

Expired

Drafts

Table columns:
Dataset
Provider
Consumer
Status
Start date
End date
Last activity
Actions

Statuses:
Active
Pending approval
Action required
Expired

Clicking a contract opens a detail drawer/page.

Show:

Contract parties

Dataset

Purpose

Permissions

Duration

Usage restrictions

Data handling requirements

Audit history

Create a clear "Data usage conditions" section.

6. My Data / Provider dashboard

MDS has two sides: data consumers and data providers.

Create a provider-oriented dashboard.

Title:
"My Data"

Show:

Published datasets

Active subscriptions

Pending access requests

Data usage

Data quality

Contracts

Dataset management table:

Dataset
Status
Subscribers
Last updated
Data quality
Visibility
Actions

Include a clear CTA:
"+ Publish dataset"

7. Publish dataset flow

Create a simple wizard:

Dataset information

Data source

Access conditions

Data quality

Review

Publish

Fields:
Dataset name
Description
Category
Geographic coverage
Update frequency
Data format
License
Access model

Add a useful "Data sovereignty" explanation:

"Your data remains with your organization. MDS manages discovery, permissions and contractual access without storing the underlying raw dataset."

Make this understandable and reassuring rather than overly technical.

8. Organization profile

Create organization pages.

Example:

"BMW Group"

Show:

Organization logo

Verification status

Organization type

Location

Description

Datasets offered

Data consumers

Active partnerships

Include trust indicators:

Verified organization

GDPR compliant

Data provider since...

Number of active datasets

Avoid making unsupported claims about specific organizations; use realistic placeholder content where necessary.

9. Activity / Audit Trail

Create an important transparency feature.

Title:
"Activity & audit trail"

Show a chronological timeline:

Today

Contract signed

Dataset access granted

Dataset updated

Yesterday

Access request submitted

Organization verified

Allow filtering by:

Contracts

Dataset access

Requests

Data updates

Organization activity

Each event should clearly explain:
WHAT happened
WHO initiated it
WHEN it happened
WHICH dataset/contract was involved

This should reinforce MDS's transparency and trust model.

10. Notifications center

Create a notification interface with categories:

All
Requests
Contracts
Datasets
System

Examples:
"Your access request for Real-Time Traffic Flow has been approved."

"Provider XYZ updated the dataset schema."

"Your contract expires in 30 days."

Each notification should have an appropriate CTA.

11. Global search

Design a powerful global search experience.

When the user searches "Berlin traffic", show categorized results:

Datasets
Organizations
Contracts
Documentation

Include recent searches and suggested searches.

Make search feel fast and intelligent.

12. Empty, loading and error states

Design polished states for:

No datasets found

No contracts

No access requests

Dataset temporarily unavailable

Access denied

Loading dataset

API/data connection issue

Use helpful explanations and clear next actions rather than generic error messages.

Important UX improvements

Build the UI around these principles:

1. Reduce complexity

Users should not need to understand the underlying technical architecture to use MDS.

Use plain-language explanations with optional technical details.

2. Make trust visible

Introduce consistent trust indicators for:

Verified organizations

Dataset quality

Data freshness

Contract status

Access permissions

Compliance information

3. Make dataset discovery extremely easy

Search and filtering should be the core interaction.

4. Explain access clearly

Users should always understand:

Who owns the data

Who can access it

Under what conditions

For how long

For what purpose

5. Support both providers and consumers

The navigation and dashboard should adapt depending on the user's role.

6. Add useful comparison

Allow users to select datasets and compare:

Coverage

Freshness

Update frequency

Format

Access model

License

Provider

Availability

7. Add personalization

Include:

Favorites

Saved searches

Recommended datasets

Recently viewed datasets

Notifications

8. Accessibility

Design to WCAG-friendly principles:

Strong contrast

Clear focus states

Keyboard-friendly interactions

Large enough click targets

Do not rely only on color to communicate status

Clear labels and error messages

Prototype behavior

Create the screens as a connected high-fidelity prototype.

Important interactions:

Dashboard → dataset

Search → dataset results

Dataset → dataset detail

Dataset detail → request access

Request access → confirmation

Dataset → organization

Dashboard → contracts

Contract → contract detail

Provider dashboard → publish dataset

Notifications → relevant page

Global search → categorized results

Favorites → saved datasets

Include hover, active, selected, loading and disabled states where appropriate.

Design system

Create reusable components and a consistent design system.

Components should include:

Buttons

Inputs

Search

Dropdowns

Filters

Tabs

Cards

Tables

Badges

Status indicators

Toast notifications

Modals

Drawers

Breadcrumbs

Pagination

Tooltips

Empty states

Use Auto Layout and reusable components throughout the design.

Create desktop-first designs at approximately 1440px width, while keeping the layouts responsive for tablet and smaller screens.

The final result should look like a real, production-ready enterprise platform, not a conceptual wireframe.

Prioritize the most important flows:

Discover data

Understand a dataset

Request access

Manage contracts

Publish/manage data

Understand activity and permissions

Use realistic but clearly fictional sample data where needed.

Do not focus on backend implementation or code. This task is UI/UX design only.