function log(message) {
    console.log.apply(console,arguments);
}

function isNotNull(o) {
    return !!o;
}


var rs = {
    taskDao:null,

    init:function (connectedCallback) {
        remoteStorage.access.claim('tasks', 'rw');
        remoteStorage.displayWidget();
        this.taskDao = remoteStorage.tasks.getPrivateList('todos');
        remoteStorage.on('features-loaded', function () {
          remoteStorage.on('disconnected', function () {
            connectedCallback(false);
          });
        });
        connectedCallback(false);
    },

    loadAll:function () {
      return this.taskDao.getAll();
    },

    onChange:function (callback) {
        this.taskDao.on('change', function (event) {
            if (event.origin === 'local') {
                return;
            }
            if (event.newValue) {
                event.newValue.id = event.id;
            }
            if (event.oldValue) {
                event.oldValue.id = event.id;
            }
            callback(event.oldValue,event.newValue);
        });
    },

    add:function (title) {
        var newTaskID = this.taskDao.add(title);
        var task = this.taskDao.get(newTaskID);
        task.id = newTaskID;
        return task;
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

function isBlank(s) {
    return !s || s.isBlank();
}

function TaskController($scope) {
    $scope.isConnected = false;
    $scope.tasks = [];

    function refresh() {
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    }

    rs.init(function (connected) {
        $scope.isConnected = connected;
        if(! connected) {
            $scope.tasks = [];
        }
        refresh();
    });

    rs.loadAll().then(function(tasks) {
      log("Load All",tasks);
        $scope.tasks = tasks;
    });

    rs.onChange(function (oldTask,newTask) {
        if (!newTask) {
            $scope.tasks.remove({id:oldTask.id});
            return;
        }
        try {
            var existingTask = $scope.tasks.find({id:newTask.id});
            if (existingTask) {
                Object.merge(existingTask, newTask);
            } else {
                $scope.tasks.insert(newTask,0);
            }
        } catch(e) {
            $scope.tasks.insert(newTask,0);
        }
        refresh();
    });

    $scope.noTaskTitleWarning = false;
    $scope.addTask = function () {
        if (isBlank($scope.taskText)) {
            $scope.noTaskTitleWarning = true;
            return;
        }
        rs.add($scope.taskText);
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
        if (task.completed && isTracking(task)) {
            finishTracking(task);
        }
        rs.taskDao.markCompleted(task.id, task.completed);
    };

    setInterval(function () {
        refresh();
    }, 1000);

}
