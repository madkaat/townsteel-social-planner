# TownSteel Social Planner

A lightweight LinkedIn content planner I built to run TownSteel's company page with a clear strategy instead of one-off posts. It organizes five posts a week around four content pillars and tracks how each pillar performs.

**Live site:** `https://YOUR-USERNAME.github.io/townsteel-social-planner/` (update this after you turn on GitHub Pages)

## The problem

The marketing team asked social to promote several priorities at once: AegisSync, TownSteel as an ODM (Original Design Manufacturer), the multifamily electronic lock portfolio, and general company news. Without a framework, every topic competes for the same few posts and the audience can't tell what TownSteel wants to be known for.

## The approach

**Four pillars, each with its own job and audience**

| Pillar | Job | Audience |
|---|---|---|
| ODM / Manufacturing Partnerships | Business development | Brands, product companies, OEMs |
| AegisSync | Product growth | Multifamily owners, operators, distributors |
| Multifamily Electronic Locks | Portfolio growth | Distributors, locksmiths, property managers |
| TownSteel Brand | Brand awareness | Industry, channel partners, end users |

**A repeatable weekly rhythm**: each day has a purpose rather than a fixed product, so timely news can slot in without rebuilding the plan.

| Mon | Tue | Wed | Thu | Fri |
|---|---|---|---|---|
| Manufacturing Monday (ODM) | Product Spotlight (AegisSync) | Electronic Access Wednesday | Growth Priority (alternates ODM / AegisSync) | TownSteel in the Industry |

**A staged ODM story**: Awareness, then Credibility, then Conversion, so the page earns trust before it asks for business.

## Features

- **Calendar**: Mon to Fri week view with daily themes, a pillar mix bar for balance, a weekly focus line, and a "Copy week plan" button for sharing with the team.
- **Post editor**: title, pillar, format, goal, caption with LinkedIn character count, asset link, notes, status, stage, and results.
- **Idea bank**: unscheduled ideas filtered by pillar, scheduled into an open day with one click.
- **Journeys**: any pillar can move through stages (ODM uses Awareness, Credibility, Conversion), with posts sorted by stage and a checklist for each journey.
- **Performance**: impressions, engagement rate, and clicks by pillar, a weekly follower log, and CSV export.
- **Backup**: data saves in the browser automatically; export and import a JSON backup anytime.

## Built to change with the strategy

Priorities shift, so the strategy lives in the data, not the code. From **Strategy & settings** you can:

- Add, rename, recolor, and reorder content pillars
- Archive a pillar so it stops appearing for new posts while its history and results stay intact
- Set each weekday's theme and pillar, or have a day alternate between two pillars every other week
- Turn on stages for any pillar and edit its checklist
- Edit the lists of formats, statuses, and working rules

Charts, filters, and the calendar adjust automatically to whatever pillars exist.

## Tech

Plain HTML, CSS, and JavaScript. No frameworks, no build step, no server. Hosted free on GitHub Pages.

```
index.html        page layout
css/styles.css    styling (light and dark mode)
js/seed.js        starter pillars, themes, formats, statuses, first 20 posts
js/app.js         the app: calendar, editors, idea bank, journeys, performance, settings
```

## Your data

Posts are saved in your browser's local storage on the computer you use. They are not uploaded to GitHub, so nothing internal ends up in a public repo. Use **Strategy & settings > Export backup** regularly, and **Import backup** to move to another computer or browser. Clearing your browser data will erase the planner, so keep a recent backup.
