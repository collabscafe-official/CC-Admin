import collabs from "../../config/collabs";
import { toast } from "react-toastify";
import { GET_COUNTRIES, GET_STATES, GET_CITIES } from "../types";

export const getCountries = (page = 1, is_active = true, callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.get(`/global/countries?page=${page}&is_active=${is_active}`);
            if (response.data.success) {
                dispatch({ type: GET_COUNTRIES, payload: response.data.data });
                callback(true);
            } else {
                dispatch({ type: GET_COUNTRIES, payload: null });
                toast.error(response.data.message);
                callback(false);
                return;
            }
        } catch (error) {
            dispatch({ type: GET_COUNTRIES, payload: null });
            toast.error('Failed to get countries');
            callback(false);
            return;
        }
    }
}

export const getStates = (country_id = '', page = 1, is_active = true, callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.get(`/global/states?country_id=${country_id}&page=${page}&is_active=${is_active}`);
            if (response.data.success) {
                dispatch({ type: GET_STATES, payload: response.data.data });
                callback(true);
            } else {
                dispatch({ type: GET_STATES, payload: null });
                toast.error(response.data.message);
                callback(false);
                return;
            }
        } catch (error) {
            dispatch({ type: GET_STATES, payload: null });
            toast.error('Failed to get states');
            callback(false);
            return;
        }
    }
}

export const getCities = (country_id = '', state_id = '', page = 1, is_active = true, callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.get(`/global/cities?country_id=${country_id}&state_id=${state_id}&page=${page}&is_active=${is_active}`);
            if (response.data.success) {
                dispatch({ type: GET_CITIES, payload: response.data.data });
                callback(true);
            } else {
                dispatch({ type: GET_CITIES, payload: null });
                toast.error(response.data.message);
                callback(false);
                return;
            }
        } catch (error) {
            dispatch({ type: GET_CITIES, payload: null });
            toast.error('Failed to get cities');
            callback(false);
            return;
        }
    }
}
