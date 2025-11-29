import collabs from "../../config/collabs";
import { GET_CREATORS } from "../types";
import { toast } from "react-toastify";

export const getCreators = (limit = 10, page = 1, is_active = '', is_email_verified = '', is_profile_completed = '', is_approved_by_admin = '', is_featured = '', country = '', state = '', city = '', gender = '', callback) => {
    return async (dispatch) => {
        try {
            // Build query parameters - only include non-empty values
            const params = new URLSearchParams();
            params.append('limit', limit);
            params.append('page', page);
            
            if (is_active !== '') params.append('is_active', is_active);
            if (is_email_verified !== '') params.append('is_email_verified', is_email_verified);
            if (is_profile_completed !== '') params.append('is_profile_completed', is_profile_completed);
            if (is_approved_by_admin !== '') params.append('is_approved_by_admin', is_approved_by_admin);
            if (is_featured !== '') params.append('is_featured', is_featured);
            if (country !== '') params.append('country', country);
            if (state !== '') params.append('state', state);
            if (city !== '') params.append('city', city);
            if (gender !== '') params.append('gender', gender);
            
            const queryString = params.toString();
            const response = await collabs.get(`/admin/influencers/list?${queryString}`);
            
            if (response.data.success) {
                dispatch({ type: GET_CREATORS, payload: response.data.data });
                callback(true);
            } else {
                dispatch({ type: GET_CREATORS, payload: null });
                toast.error('Failed to get creators');
                callback(false);
            }
        } catch (error) {
            dispatch({ type: GET_CREATORS, payload: null });
            toast.error('Failed to get creators');
            callback(false);
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

export const deleteCreator = (id, callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.delete(`/admin/influencers/delete`, {
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