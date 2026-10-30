# Usability review before Milestone 3

| Area                        | Issues addressed                                                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation and dashboard    | Larger Backlog wordmark and navigation text; readable deal titles, prices, store names, and links; full artwork instead of cropped backgrounds; currently-playing games first; actual price-alert count rather than wishlist size.                                                       |
| Deals                       | Store identity and purchase links; multiple store selection; stackable price, discount, Steam activation, sale, and ownership filters; sorting; grid/list views; page-size selection and pagination; filters and view saved in the URL; clear search/reset and useful empty states.      |
| Game Hub                    | Clear ownership selection; completion controls for owned games; target price and watch preferences for wishlist games; valid price entry and clearing; saved-state feedback; preserved purchase/progress values when switching membership; removal with Undo.                            |
| Library                     | Title/AppID search; playing-first, title, and purchase-price sorting; removal with Undo; blank purchase amounts distinguished from free purchases; export waits for pending edits.                                                                                                       |
| Wishlist                    | Title search; title, current-price, and distance-to-target sorting; mark owned without guessing an amount paid; removal with Undo; personal guest data no longer labeled as demo data.                                                                                                   |
| Updates                     | Collection game selector; official posts by default; optional community/press posts; existing game pills, custom AppID, tabs, and keyboard navigation retained.                                                                                                                          |
| Persistence and performance | Serialized collection writes; only private collection queries refreshed after edits; a dedicated price-only query for analytics and watches; stable server/client hydration; existing five-minute provider cache, request sharing, deadlines, and synchronous catalog fallback retained. |

## Filtering and pricing details

Store, maximum-price, Steam activation, sort, and page parameters are sent to CheapShark. Discount and hide-owned filters apply to the offers on the current page; the UI shows both the matching and fetched counts. This keeps browsing to one provider request per page instead of fetching multiple pages in parallel.

Steam activation is reported by the provider and may require checking the seller's activation details. A Steam AppID alone is not treated as proof of activation. Store names and outbound offer links remain separate from the game's Steam page.

Cached catalog offers are labeled and respect supported store and price constraints. An empty successful filtered search does not substitute unrelated games. Historical prices that are not known remain marked as not recorded. Marking a game owned does not create a purchase amount.

## Later milestones

OAuth, Steam account linking, and owned-game import remain in Milestone 3. Scheduled checks and notification delivery remain in Milestone 4. Desktop detection, playtime collection, and native launching integrations remain in Milestone 5. Existing guest storage and account persistence continue to work independently of those additions.
