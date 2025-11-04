import Axios from "axios"
import config from "./config"
const collabs = Axios.create({
    baseURL: config.base_url,
    // baseURL: 'https://cclive.collabscafe.com/v1',
    // baseURL:'http://172.16.1.85:3000/v1',
    // baseURL:'http://172.16.2.165:9090',
})

collabs.interceptors.request.use(config => {
    const token = localStorage.getItem('dashboard-user');
    if (token) {
        config.headers['Authorization'] = `Bearer ${JSON.parse(token).token}`;
    }
    return config;
});

export default collabs