function log(message) {
    console.log(message);
}

var rs = {
    taskDao:null,

    init:function () {
        remoteStorage.util.silenceAllLoggers();
        remoteStorage.claimAccess('tasks', 'rw');
        remoteStorage.displayWidget('remotestorage-connect');
        this.taskDao = remoteStorage.tasks.getPrivateList('todos');
    },

    loadAll:function () {
        var taskDao = this.taskDao;
        return taskDao.getIds().map(function (id) {
            var task = taskDao.get(id);
            task.id = id;
            return task;
        });
    },

    onChange:function (callback) {
        this.taskDao.on('change', function (event) {
            log("Event:");
            log(event);
            var task = event.newValue;
            task.id = event.id;
            callback(task);
        });
    },

    add:function (title) {
        return this.taskDao.get(this.taskDao.add(title));
    }
}

function formatTimeSpan(ms) {
    if (!ms) {
        return 'Nothing';
    }
    var seconds = Math.floor(ms / 1000);
    var secondsPart = Math.floor(seconds % 60);
    var minutesPart = Math.floor(seconds / 60 % 60);
    var hoursPart = Math.floor(seconds / 60 / 60);
    var timeString = secondsPart + ' s';
    if (minutesPart) {
        timeString = minutesPart + ' minutes ' + timeString;
    }
    if (hoursPart) {
        timeString = hoursPart + ' hours ' + timeString;
    }
    return timeString;
}

function isTracking(task) {
    return task.timeTracking && task.timeTracking.startTime;
}

function startTracking(task) {
    if (!task.timeTracking) {
        task.timeTracking = {spentTime:0}
    }
    task.timeTracking.startTime = Date.now();
    rs.taskDao.setTimeTracking(task.id, task.timeTracking);
}

function finishTracking(task) {
    var timeTracking = task.timeTracking;
    timeTracking.spentTime += Date.now() - timeTracking.startTime;
    timeTracking.startTime = null;
    rs.taskDao.setTimeTracking(task.id, task.timeTracking);
}

function TaskController($scope) {
    rs.init();

    $scope.tasks = rs.loadAll();

    rs.onChange(function (task) {
        var existingTask = $scope.tasks.find({id:task.id});
        if (existingTask) {
            Object.merge(existingTask, task);
        } else {
            $scope.tasks.push(task);
        }
        $scope.$apply();
    });

    $scope.addTask = function () {
        var task = rs.add($scope.taskText);
        $scope.tasks.push(task);
        $scope.taskText = '';
    };

    $scope.remaining = function () {
        var count = 0;
        angular.forEach($scope.tasks, function (task) {
            count += task.completed ? 0 : 1;
        });
        return count;
    };

    $scope.removeFinishedTasks = function () {
        var oldTasks = $scope.tasks;
        $scope.tasks = [];
        angular.forEach(oldTasks, function (task) {
            if (task.completed) {
                rs.taskDao.remove(task.id);
            } else {
                $scope.tasks.push(task);
            }
        });
    };

    $scope.trackButtonLabel = function (task) {
        return isTracking(task) ? 'Tracking...' : 'Track'
    };

    $scope.spentTimeLabel = function (task) {
        var timeTracking = task.timeTracking;
        if (!timeTracking) {
            return '';
        }
        var spentTime = timeTracking.spentTime;
        if (timeTracking.startTime) {
            spentTime += Date.now() - timeTracking.startTime;
        }
        return formatTimeSpan(spentTime);
    };

    $scope.onTrackButton = function (task) {
        if (isTracking(task)) {
            finishTracking(task);
        } else {
            startTracking(task);
        }
    };

    $scope.onToggledCompleted = function (task) {
        rs.taskDao.markCompleted(task.id, task.completed);
    };

    setInterval(function () {
        $scope.$apply();
    },1000);

}
