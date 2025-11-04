import { combineReducers } from "redux";
import user from "./reducers/user"
import creators from "./reducers/creators"
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
    // localFields,
    // platforms,
    // deliverables,
    // niches,
    // countries,
    // states,
    // cities
});
