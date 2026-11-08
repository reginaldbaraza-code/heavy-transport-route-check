# Speaker notes — Faster, safer decisions for heavy-transport routes

## 1. Title

We are focusing on heavy-transport route readiness. The product does not speed up authority approval directly; it reduces the risk that an approved permit becomes unusable because route conditions changed.

## 2. The pivot

Our first prototype was a broad, friendlier MDS marketplace. After narrowing the use case, we retained only the relevant data-discovery foundation and redesigned the primary experience around one dispatcher decision.

## 3. Research trail

Explain the sequence rather than presenting the final idea as obvious. The team began with matching, compared possible use cases, spoke to the field, and then learned that recommendation or rerouting was not appropriate because the permit route is fixed.

Use the interview count that matches the evidence in the submitted WIP deck. Do not imply that prototype testing has occurred.

## 4. The problem

Normal navigation tools can suggest another route. Heavy transport cannot simply take it. Dimensions, bridge capacity, restrictions, permit windows, and authority approval make the route specific to the load.

## 5. Current process

VEMAGS is a portal and coordination mechanism, not the final decision-maker. Authorities and hearing bodies review the application. Once the permit is issued, changing conditions can still make it unusable.

## 6. User story

The user story focuses on the dispatcher’s goal and benefit. It intentionally avoids naming an upload screen, dashboard, AI, or map as the solution.

## 7. Proposed workflow

Stress that the tool checks the exact corridor. Official data is combined with fresh observations when the official status is uncertain. The product explains why it recommends Ready, Monitor, or Hold.

## 8. Prototype

The current React scaffold simulates route import, corridor checking, evidence review, verification requests, and continuous monitoring. Data integrations and JSON parsing are not yet implemented.

## 9. Methods

The Excalidraw artifacts are low-fidelity and easy to change. The working prototype is a scaffold for testing behavior. Crazy 8s and Wizard of Oz are planned methods, not completed activities.

## 10. Planned evaluation

The facilitator manually controls the verification outcome. This tests whether the workflow is useful before investing in real-time integrations or a contributor network.

## 11. Audit trail

Use one clear example: fixed route led to exact-corridor preservation, which led to removing alternative-route generation and adding VEMAGS route import. The JSON assumption remains open.

## 12. Research honesty

Clearly separate evidence from assumptions. The team has transporter evidence but still needs the authority perspective, usability evaluation, and technical validation.

## 13. Next

The next decision is not “Which feature should we add?” It is “Does this workflow help dispatchers make a safer decision early enough to matter?”
