function log(message) {
    console.log(message);
}

var rs = {
    taskDao:null,

    init:function (onStateCallback) {
        remoteStorage.util.silenceAllLoggers();
        remoteStorage.claimAccess('tasks', 'rw');
        remoteStorage.displayWidget('remotestorage-connect');
        remoteStorage.onWidget('state', onStateCallback);
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
    },

    getState:function () {
        return remoteStorage.getWidgetState();
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
    return !!(task.timeTracking && task.timeTracking.startTime);
}

function startTracking(task) {
    if (!task.timeTracking) {
        task.timeTracking = {spentTime:0}
    }
    task.timeTracking.startTime = Date.now();
    saveTimeTracking(task);
}

function finishTracking(task) {
    var timeTracking = task.timeTracking;
    timeTracking.spentTime += Date.now() - timeTracking.startTime;
    timeTracking.startTime = null;
    saveTimeTracking(task);
}

function addTime(task, timeToAdd) {
    if (!timeToAdd) {
        return;
    }
    if (!task.timeTracking) {
        task.timeTracking = {spentTime:timeToAdd};
    } else {
        task.timeTracking.spentTime += timeToAdd;
    }
    saveTimeTracking(task);
}

function saveTimeTracking(task) {
    rs.taskDao.setTimeTracking(task.id, task.timeTracking);
}

function isConnected(state) {
    return  (state == 'connected') || (state == 'busy');
}

function isBlank(s) {
    return !s || s.isBlank();
}

function TaskController($scope) {
    function refresh() {
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    }

    $scope.isConnected = isConnected(rs.getState());

    rs.init(function (state) {
        $scope.isConnected = isConnected(state);
        refresh();
    });

    $scope.tasks = rs.loadAll();

    rs.onChange(function (task) {
        var existingTask = $scope.tasks.find({id:task.id});
        if (existingTask) {
            Object.merge(existingTask, task);
        } else {
            $scope.tasks.push(task);
        }
        refresh();
    });


    $scope.noTaskTitleWarning = false;
    $scope.addTask = function () {
        if (isBlank($scope.taskText)) {
            $scope.noTaskTitleWarning = true;
            return;
        }
        var task = rs.add($scope.taskText);
        $scope.tasks.insert(task,0);
        $scope.taskText = '';
    };
    $scope.$watch('taskText', function (value) {
        if (!isBlank($scope.taskText)) {
            $scope.noTaskTitleWarning = false;
        }
    });

    $scope.remaining = function () {
        var count = 0;
        angular.forEach($scope.tasks, function (task) {
            count += task.completed ? 0 : 1;
        });
        return count;
    };

    $scope.removeFinishedTasks = function () {
        var finishedTasks = $scope.tasks.filter({completed:true});
        $scope.tasks = $scope.tasks.subtract(finishedTasks);
        finishedTasks.forEach(function (task) {
            rs.taskDao.remove(task.id);
        });
    };

    $scope.removeTask = function (task) {
        $scope.tasks.remove(task);
        rs.taskDao.remove(task.id);
    };

    $scope.isTracking = isTracking;

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

    function finishCurrentTracking() {
        $scope.tasks.filter(isTracking).forEach(finishTracking);
    }
    
    $scope.onTrackButton = function (task) {
        if (isTracking(task)) {
            finishTracking(task);
        } else {
            finishCurrentTracking();
            startTracking(task);
        }
    };

    $scope.addedHours = 1;
    $scope.addedMinutes = 0;
    $scope.showAddTimeDialog = function (task) {
        $scope.currentTask = task;
        $('#addTimeDialog').modal();
        setTimeout(function () {
            $('#addedHours').focus();
        }, 1000);
    };

    $scope.addTime = function () {
        var timeToAdd = ($scope.addedHours.toNumber() * 60 + $scope.addedMinutes.toNumber()) * 60000;
        addTime($scope.currentTask, timeToAdd);
        $('#addTimeDialog').modal('hide');
    };

    $scope.onToggledCompleted = function (task) {
        rs.taskDao.markCompleted(task.id, task.completed);
    };

    setInterval(function () {
        refresh();
    }, 1000);

}
