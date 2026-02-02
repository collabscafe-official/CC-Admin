import { combineReducers } from "redux";
import user from "./reducers/user"
import creators from "./reducers/creators"
import brands from "./reducers/brands"
import influencerStats from "./reducers/influencerStats"
import locationsRed from "./reducers/locationsRed"
// import localFields from "./users/reducers/userlocal"
// import platforms from "./globals/reducers/platform"
// import deliverables from "./globals/reducers/deliverable"
// import niches from "./globals/reducers/niches"
// import countries from "./globals/reducers/countriesRed"
// import states from "./globals/reducers/statesRed"
// import cities from "./globals/reducers/citiesRed"

export default combineReducers({
    user,
    creators,
    brands,
    influencerStats,
    locationsRed,
    // localFields,
    // platforms,
    // deliverables,
    // niches,
    // countries,
    // states,
    // cities
});
