var deepmerge = require('deepmerge');

function clone(o) {
    if (typeof o === 'object') {
        return deepmerge({}, o, {clone: true});
    }
    return o;
}

function CallbackFiller(options) {
    if (typeof options !== 'object') {
        options = {};
    }
    this.safeClone = options.safeClone || false;
    this.queues = {};
}

CallbackFiller.prototype.fill = function(key, err, data) {
    var waiting = this.queues[key];
    delete this.queues[key];

    if (waiting && waiting.length) {
        waiting.forEach(function(task, index) {
            (task.cb)(err, (index > 0 && this.safeClone) ? clone(data) : data);
        });
    }
};

CallbackFiller.prototype.has = function(key) {
    return this.queues[key];
};

CallbackFiller.prototype.add = function(key, funcObj) {
    if (this.queues[key]) {
        this.queues[key].push(funcObj);
    } else {
        this.queues[key] = [funcObj];
    }
};

module.exports = CallbackFiller;
