import { applyMiddleware, compose, legacy_createStore as createStore } from "redux";
import rootReducer from "./rootReducer";
import { thunk } from "redux-thunk";
const composeEnhancers = compose;
const Store = createStore(rootReducer, composeEnhancers(applyMiddleware(thunk)))
export default Store;
