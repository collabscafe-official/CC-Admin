import { GET_INFLUENCER_STATS } from "../types";

export default function influencerStats(state = null, action) {
    switch (action.type) {
        case GET_INFLUENCER_STATS:
            return action.payload;
        default:
            return state
    }
}