import { GET_CREATORS } from "../types";

export default function creators(state = null, action) {
    switch (action.type) {
        case GET_CREATORS:
            return action.payload;
        default:
            return state
    }
}