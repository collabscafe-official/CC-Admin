import { GET_COUNTRIES, GET_STATES, GET_CITIES } from "../types";

export default function locationsRed(state = {
    countries: null,
    states: null,
    cities: null
}, action) {
    const { type, payload } = action;
    switch (type) {
        case GET_COUNTRIES:
            return {
                ...state,
                countries: payload
            };
        case GET_STATES:
            return {
                ...state,
                states: payload
            };
        case GET_CITIES:
            return {
                ...state,
                cities: payload
            };
        default:
            return state;
    }
}