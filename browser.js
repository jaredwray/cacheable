module.exports = {
    get(key) {
        return localStorage.getItem(key); // eslint-disable-line no-undef
    },
    set(key, content) {
        return localStorage.setItem(key, content); // eslint-disable-line no-undef
    },
    del(key) {
        return localStorage.removeItem(key); // eslint-disable-line no-undef
    }
};
