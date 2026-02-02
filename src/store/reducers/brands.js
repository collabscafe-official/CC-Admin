import { GET_BRANDS } from "../types";

export default function brands(state = null, action) {
    switch (action.type) {
        case GET_BRANDS:
            return action.payload;
        default:
            return state
    }
}
