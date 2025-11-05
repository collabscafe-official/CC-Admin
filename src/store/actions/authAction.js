import collabs from "../../config/collabs";
import { LOGIN, LOGOUT } from "../types";
import { toast } from "react-toastify";

export const login = (email, password, callback) => {
    return async (dispatch) => {
        try {
            const response = await collabs.post("/auth/admin/signin", { email, password });
            if (response.data.success) {
                const userData = response.data.data;
                const token = response.data.data.token;
                // Save user to localStorage
                localStorage.setItem('dashboard-user', JSON.stringify(userData));
                dispatch({ type: LOGIN, payload: userData });
                toast.success(response.data.message || 'Login successful');
                collabs.defaults.headers.common['Authorization'] = "Bearer " + token;
                callback();
            } else {
                toast.error(response.data.message || 'Login failed');
                callback();
            }
        } catch (error) {
            toast.error(error.response.data.message || 'Login failed');
            callback();
            console.log(error);
        }
    }
}

export const logout = () => {
    return (dispatch) => {
        // Remove user from localStorage
        localStorage.removeItem('dashboard-user');
        dispatch({ type: LOGOUT });
        toast.success("Logged out successfully");
    }
}