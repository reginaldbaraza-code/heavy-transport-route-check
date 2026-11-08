# Heavy transport prototype methods

This package applies the methods from the supplied prototyping materials without presenting planned research as completed research.

## 1. Prototype objective

**Question:** Can a dispatcher understand whether an already-permitted heavy-transport route is usable before departure, and what to do when the available roadworks evidence is uncertain?

The prototype is deliberately limited to route readiness. It does not replace VEMAGS, issue permits, or calculate an unapproved alternative route.

## 2. Audience, context, and goal

- **Primary user:** Dispatcher or route planner at a heavy-haul company.
- **Context:** Desktop use in an operations office, shortly before a scheduled transport.
- **Constraint:** The vehicle may only use the route approved in its permit.
- **Goal:** Avoid starting a transport that will become blocked by a closure, restriction, or unverified roadworks site.

## 3. User story

> As a heavy-transport dispatcher, I want to check the exact permitted route against current and trustworthy road conditions so that I can decide whether the transport can depart without becoming stranded.

This expresses the goal and benefit rather than prescribing a feature.

## 4. Information needs

The dispatcher needs:

1. The exact permitted route and permit identifier.
2. Planned departure time and permit time window.
3. Vehicle and load weight, width, height, and length.
4. Current closures, roadworks, incidents, and physical restrictions on each route segment.
5. Source, freshness, confidence, and geographic precision of every warning.
6. Evidence that a listed roadworks site is actually active.
7. A clear Ready, Monitor, or Hold decision.
8. The next safe action when evidence is incomplete.

## 5. Task flow and user flow

- The **task flow** shows the ideal, branch-free path: import route, confirm profile, check corridor, review result, monitor, and decide.
- The **user flow** includes failures and uncertainty: invalid file, missing dimensions, stale data, conflicting evidence, a new alert after checking, and no verification response.

Editable versions are provided in:

- `04-user-story-and-task-flow.excalidraw`
- `05-unhappy-path-and-wizard-of-oz.excalidraw`

## 6. Wireframe and scaffold strategy

The methods are complementary:

- Use the Excalidraw wireframes and flows for structural questions and rapid changes.
- Use the working React prototype as a **scaffold** for interaction questions such as whether the warning, evidence panel, and verification request are understandable.
- Do not treat visual polish as proof that the product direction is validated.

## 7. Wizard of Oz evaluation plan

The current prototype does not have live VEMAGS, Autobahn, or participant data. During evaluation, a facilitator can simulate these systems:

1. Give the participant a permitted route and departure deadline.
2. Let them import the route and review the initial Hold status.
3. When they request verification, manually trigger a prepared observation.
4. Test three scenarios:
   - Roadworks confirmed active.
   - Roadworks confirmed absent.
   - No response before the decision deadline.
5. Ask the participant to explain the status, evidence, and next action in their own words.

Observe comprehension, hesitation, unsafe assumptions, and whether the participant attempts to choose an unapproved detour. Do not measure visual preference as the primary result.

## 8. Crazy 8s workshop

Use `06-crazy-8s-route-warning-template.excalidraw` for an eight-minute team exercise. Sketch eight ways to communicate one user story:

> A roadworks entry may be outdated, and the dispatcher must decide whether to hold departure.

After eight minutes, compare concepts using:

- Clarity of the dispatch status.
- Visibility of evidence freshness.
- Safety under uncertainty.
- Clear distinction between checking and rerouting.
- Ability to request human verification.

This workshop is prepared but has not yet been conducted.

## 9. Decision maturity and assumptions

Prototype maturity and decision maturity are tracked separately in `07-prototype-decision-review.excalidraw`.

### Supported by current research

- Heavy transports depend on fixed, authority-approved routes.
- Short-notice route changes can cause costly delays and new permit applications.
- Roadworks information can be incomplete or outdated.
- Dispatchers need information before departure.

### Still assumed

- A useful VEMAGS route can be imported as JSON.
- Nearby participants will provide timely and trustworthy observations.
- MDS can combine all required public and private data.
- Ready, Monitor, and Hold are the correct decision states.
- The proposed workflow fits dispatch operations.

### What would make us change or abandon this direction?

- Dispatchers cannot obtain a machine-readable permitted route.
- Existing tools already provide sufficiently reliable corridor monitoring.
- Verification responses arrive too late to affect departure decisions.
- Authorities or operators cannot legally rely on participant observations.
- Dispatchers need a different intervention earlier in the permit process.

## 10. Next evaluation

Test the scaffold with heavy-transport dispatchers and separately interview authorities or hearing bodies. Frame the prototype as one proposed direction:

> We are confident about the route-uncertainty problem, but not yet about this interaction. Please show us what would make it unsafe or unusable.
