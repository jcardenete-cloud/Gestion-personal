import axios from 'axios';

export const getApiUrl = () => {
    return localStorage.getItem('api_url') || import.meta.env.VITE_API_URL || 'http://192.168.145.122:5000/api';
};

export const setApiUrl = (url) => {
    if (url) {
        localStorage.setItem('api_url', url.trim());
    } else {
        localStorage.removeItem('api_url');
    }
};

const API_URL = {
    toString() {
        return getApiUrl();
    }
};

const api = {
    getApiUrl,
    setApiUrl,
    login: (username, password, db_type = 'oracle') => axios.post(`${API_URL}/login`, { username, password, db_type }),

    getEncargos: () => axios.get(`${API_URL}/encargos`),
    createEncargo: (data) => axios.post(`${API_URL}/encargos`, data),
    updateEncargo: (data) => axios.put(`${API_URL}/encargos`, data),
    deleteEncargo: (id) => axios.delete(`${API_URL}/encargos?codigopr=${id}`),

    getPersonal: () => axios.get(`${API_URL}/personal`),
    createPersonal: (data) => axios.post(`${API_URL}/personal`, data),
    updatePersonal: (data) => axios.put(`${API_URL}/personal`, data),
    deletePersonal: (id) => axios.delete(`${API_URL}/personal?ref_per=${id}`),
    bulkUpdatePersonalLocation: (ref_pers, new_location) => axios.post(`${API_URL}/personal/bulk-location`, { ref_pers, new_location }),

    getAssignments: (codigopr) => axios.get(`${API_URL}/personal-proyectos${codigopr ? `?codigopr=${codigopr}` : ''}`),
    createAssignment: (data) => axios.post(`${API_URL}/personal-proyectos`, data),
    updateAssignment: (data) => axios.put(`${API_URL}/personal-proyectos`, data),
    deleteAssignment: (ref_per, codigopr) => axios.delete(`${API_URL}/personal-proyectos?ref_per=${ref_per}&codigopr=${codigopr}`),

    getUbicacion: () => axios.get(`${API_URL}/ubicacion`),
    createUbicacion: (data) => axios.post(`${API_URL}/ubicacion`, data),
    updateUbicacion: (data) => axios.put(`${API_URL}/ubicacion`, data),
    deleteUbicacion: (id) => axios.delete(`${API_URL}/ubicacion?ref_ubi=${id}`),

    getSchema: () => axios.get(`${API_URL}/schema`),
    runQuery: (sql) => axios.post(`${API_URL}/query`, { sql }),
    exportBackup: () => axios.get(`${API_URL}/backup/export`),
    importBackup: (data) => axios.post(`${API_URL}/backup/import`, data),

    getVacaciones: (ref_per, year, origen_fichero, codigopr) => {
        let url = `${API_URL}/vacaciones?`;
        if (ref_per) url += `ref_per=${ref_per}&`;
        if (year) url += `year=${year}&`;
        if (origen_fichero) url += `origen_fichero=${encodeURIComponent(origen_fichero)}&`;
        if (codigopr) url += `codigopr=${encodeURIComponent(codigopr)}&`;
        return axios.get(url);
    },
    getVacacionesFicheros: () => axios.get(`${API_URL}/vacaciones/ficheros`),
    importVacaciones: (data) => axios.post(`${API_URL}/vacaciones/import`, data),
    updateVacacion: (id, data) => axios.put(`${API_URL}/vacaciones`, { id, ...data }),
    deleteVacacion: (id) => axios.delete(`${API_URL}/vacaciones?id=${id}`),
    deleteVacacionesPorFichero: (filename) => axios.delete(`${API_URL}/vacaciones?origen_fichero=${encodeURIComponent(filename)}`),
    // Festivos (holidays) API
    getFestivos: (year, ref_ubi) => {
        let url = `${API_URL}/festivos?`;
        if (year) url += `year=${year}&`;
        if (ref_ubi) url += `ref_ubi=${ref_ubi}&`;
        return axios.get(url);
    },
    createFestivo: (data) => axios.post(`${API_URL}/festivos`, data),
    updateFestivo: (data) => axios.put(`${API_URL}/festivos`, data),
    deleteFestivo: (id) => axios.delete(`${API_URL}/festivos?id=${id}`),
};

// Interceptor to add DB credentials to every request
axios.interceptors.request.use(config => {
    const user = localStorage.getItem('db_user');
    const pass = localStorage.getItem('db_password');
    const dbType = localStorage.getItem('db_type') || 'oracle';
    if (user && pass) {
        config.headers['X-DB-User'] = user;
        config.headers['X-DB-Password'] = pass;
        config.headers['X-DB-Type'] = dbType;
    }
    return config;
});

export default api;
