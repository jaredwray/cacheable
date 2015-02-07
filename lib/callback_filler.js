var domain = require('domain');

function CallbackFiller() {
    this.queues = {};
}

CallbackFiller.prototype.fill = function(key, err, data) {
    var self = this;

    var waiting = self.queues[key];
    delete self.queues[key];

    waiting.forEach(function(task) {
        var taskDomain = task.domain || domain.create();
        taskDomain.bind(task.cb)(err, data);
    });
};

module.exports = CallbackFiller;
