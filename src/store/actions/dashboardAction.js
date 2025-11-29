import collabs from "../../config/collabs";
import { GET_INFLUENCER_STATS } from "../types";
import { toast } from "react-toastify";

export const getInfluencerStats = (callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.get(`/admin/dashboard/influencerstats`);
            if (response.data.success) {
                dispatch({ type: GET_INFLUENCER_STATS, payload: response.data });
                callback();
            } else {
                dispatch({ type: GET_INFLUENCER_STATS, payload: null });
                toast.error('Failed to get influencer stats');
            }
        } catch (error) {
            dispatch({ type: GET_INFLUENCER_STATS, payload: null });
            toast.error('Failed to get influencer stats');
            callback();
        }
    }
}