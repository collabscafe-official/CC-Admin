import { LOGIN, LOGOUT } from "../types";

// Load user from localStorage on initialization
const loadUserFromStorage = () => {
    try {
        const storedUser = localStorage.getItem('dashboard-user');
        if (storedUser) {
            return JSON.parse(storedUser);
        }
    } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem('dashboard-user');
    }
    return null;
};

export default function user(state = loadUserFromStorage(), action) {
    switch (action.type) {
        case LOGIN:
            return action.payload;
        case LOGOUT:
            return null;
        default:
            return state
    }
}