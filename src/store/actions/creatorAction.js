import collabs from "../../config/collabs";
import { GET_CREATORS } from "../types";
import { toast } from "react-toastify";

export const getCreators = (limit, page, callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.get(`/admin/influencers/list?limit=${limit}&page=${page}`);
            if (response.data.success) {
                dispatch({ type: GET_CREATORS, payload: response.data.data });
                callback();
            } else {
                dispatch({ type: GET_CREATORS, payload: null });
                toast.error('Failed to get creators');
            }
        } catch (error) {
            dispatch({ type: GET_CREATORS, payload: null });
            toast.error('Failed to get creators');
            callback();
        }
    }
}

export const approveCreator = (id, callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.put(`/admin/influencers/approve`, {
                _id: id,
            });
            if (response.data.success) {
                toast.success(response.data.message);
                callback(true);
            } else {
                callback(false);
            }
        } catch (error) {
            toast.error(error.response.data.message || 'Failed to approve creator');
            callback(false);
        }
    }
}