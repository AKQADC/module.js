var sinon = require('sinon');
var assert = require('assert');
var Promise = require('promise');
var ResourceManager = require('resource-manager-js');

describe('Module', function () {

    it('should return correct instance when extending', function () {
        var Module = require('../src/module');
        var prop = 'myProp';
        var method = function () {};
        var customClassProps = {my: prop, custom: method};
        var CustomClass = Module.extend(customClassProps);
        var customInstance = new CustomClass();
        assert.equal(customInstance.my, prop, 'after extending Module, custom class has its own property');
        assert.equal(customInstance.custom, method, 'custom class has its own method');
        customInstance.destroy();
    });

    it('should call its subclasses initialize method when subclass is instantiated', function () {
        var Module = require('../src/module');
        var method = function () {};
        var initializeSpy = sinon.spy();
        var customClassProps = {
            initialize: function () {
                initializeSpy();
                Module.prototype.initialize.call(this);
            }};
        var CustomClass = Module.extend(customClassProps);
        assert.equal(initializeSpy.callCount, 0, 'subclasses initialize method was not called because it hasnt been instantiated');
        var customInstance = new CustomClass();
        assert.equal(initializeSpy.callCount, 1, 'after subclass is instantiated, its initialize method is called');
        customInstance.destroy();
    });

    it('should have its prototype method called when an overriding subclass method calls it', function () {
        var Module = require('../src/module');
        var method = function () {};
        var initializeSpy = sinon.spy();
        var CustomClass = Module.extend({
            initialize: function () {
                initializeSpy();
                Module.prototype.initialize.call(this);
            }
        });
        var customInstance = new CustomClass();
        assert.equal(initializeSpy.callCount, 1, 'Module\'s initialize method is called when custom class overrides it, but calls its prototype');
        customInstance.destroy();
    });

    it('should NOT have its method called, when a method of a two-level nested child instance has the same method name', function () {
        var Module = require('../src/module');
        var subClassProps = {myMethod: sinon.spy()};
        var SubClass = Module.extend(subClassProps);
        var subClassInstance = new SubClass();
        subClassInstance.myMethod();
        assert.equal(subClassProps.myMethod.callCount, 1, '');
    });

    it('should NOT have its method called, when a method of a two-level nested child instance has the same method name', function () {
        var Module = require('../src/module');
        var subClassProps = {testMethod: null};
        var SubClass = Module.extend(subClassProps);
        var subClassedSubClassProps = {testMethod: sinon.spy()};
        var SubClassedSubClass = SubClass.extend(subClassedSubClassProps);
        var subClassedSubClassInstance = new SubClassedSubClass();
        subClassedSubClassInstance.testMethod();
        assert.equal(subClassedSubClassProps.testMethod.callCount, 1, 'when subclass A has a method that overrides the same method of the subclass it inherits from, subclass A gets called');
    });

    it('should not call onLoad() when already loaded', function () {
        var Module = require('../src/module');
        var customClassProps = {onLoad: sinon.stub().returns(Promise.resolve())};
        var CustomClass = Module.extend(customClassProps);
        var customInstance = new CustomClass();
        return customInstance.load()
            .then(function () {
                assert.equal(customClassProps.onLoad.callCount, 1, 'on first load() call onLoad() was called');
                return customInstance.load()
                    .then(function () {
                        assert.equal(customClassProps.onLoad.callCount, 1, 'on second load() call onLoad() was not called');
                        customInstance.destroy();
                    });
            });
    });

    it('should call onLoad() with first argument when load() is called', function () {
        var Module = require('../src/module');
        var module = new Module();
        var onLoadSpy = sinon.spy(module, 'onLoad');
        var mockOptions = {my: 'customModuleOptions'};
        return module.load(mockOptions)
            .then(function () {
                assert.deepEqual(onLoadSpy.args[0][0], mockOptions, 'on load() call onLoad() load was called with first arg passed to load call');
                module.destroy();
                onLoadSpy.restore();
            });
    });

    it('should add module loaded css class when when load() call is successful', function () {
        var Module = require('../src/module');
        var onLoadStub = sinon.stub(Module.prototype, 'onLoad').returns(Promise.resolve());
        var el = document.createElement('div');
        var module = new Module({el: el});
        return module.load()
            .then(function () {
                assert.ok(el.classList.contains('module-loaded'), 'on load() module loaded class was added');
                module.destroy();
                onLoadStub.restore();
            });
    });

    it('should NOT add module loaded css class when when onLoad() promise is rejected', function () {
        var Module = require('../src/module');
        var error = new Error();
        var onLoadStub = sinon.stub(Module.prototype, 'onLoad').returns(Promise.reject(error));
        var el = document.createElement('div');
        var module = new Module({el: el});
        return module.load()
            .then(function () {
                assert.ok(!el.classList.contains('module-loaded'));
                module.destroy();
                onLoadStub.restore();
            });
    });

    it('should trigger and error() with correct arguments when onLoad() promise is rejected', function () {
        var Module = require('../src/module');
        var error = new Error();
        var onLoadStub = sinon.stub(Module.prototype, 'onLoad').returns(Promise.reject(error));
        var el = document.createElement('div');
        var errorStub = sinon.stub(Module.prototype, 'error');
        var module = new Module({el: el});
        return module.load()
            .then(function () {
                assert.deepEqual(errorStub.args[0][0], error, 'error() was called and passed error object as first argument');
                module.destroy();
                onLoadStub.restore();
                errorStub.restore();
            });
    });

    it('should call onError() when error() is called', function () {
        var Module = require('../src/module');
        var module = new Module();
        var error = new Error();
        var onErrorSpy = sinon.spy(module, 'onError');
        return module.error(error)
            .then(function () {
                assert.deepEqual(onErrorSpy.args[0][0], error, 'onError() was called and passed error object as first parameter');
                module.destroy();
                onErrorSpy.restore();
            });
    });

    it('should add module error css class when when error() is triggered', function () {
        var Module = require('../src/module');
        var el = document.createElement('div');
        var module = new Module({el: el});
        return module.error()
            .then(function () {
                assert.ok(el.classList.contains('module-error'));
                module.destroy();
            });
    });

    it('load() method should still return a promise even if onLoad() custom implementation doesnt', function () {
        var Module = require('../src/module');
        var onLoadStub = sinon.stub().returns(null);
        var CustomModule = Module.extend({onLoad: onLoadStub});
        var module = new CustomModule();
        return module.load()
            .then(function () {
                assert.equal(onLoadStub.callCount, 1, 'test passed if this is called');
                module.destroy();
            });
    });

    it('should call onShow() when show() is called', function () {
        var Module = require('../src/module');
        var module = new Module();
        var onShowSpy = sinon.spy(module, 'onShow');
        return module.show()
            .then(function () {
                assert.deepEqual(onShowSpy.callCount, 1, 'onShow() was called');
                module.destroy();
                onShowSpy.restore();
            });
    });

    it('show() method should still return a promise even if onShow() custom implementation doesnt', function () {
        var Module = require('../src/module');
        var onShowStub = sinon.stub().returns(null);
        var CustomModule = Module.extend({onShow: onShowStub});
        var module = new CustomModule();
        return module.show()
            .then(function () {
                assert.equal(onShowStub.callCount, 1, 'test passed if this is called');
                module.destroy();
            });
    });

    it('should call onHide() when hide() is called', function () {
        var Module = require('../src/module');
        var module = new Module();
        var onHideSpy = sinon.spy(module, 'onHide');
        return module.hide()
            .then(function () {
                assert.deepEqual(onHideSpy.callCount, 1, 'onHide() was called');
                module.destroy();
                onHideSpy.restore();
            });
    });

    it('hide() method should still return a promise even if onShow() custom implementation doesnt', function () {
        var Module = require('../src/module');
        var onHideStub = sinon.stub().returns(null);
        var CustomModule = Module.extend({onHide: onHideStub});
        var module = new CustomModule();
        return module.hide()
            .then(function () {
                assert.equal(onHideStub.callCount, 1, 'test passed if this is called');
                module.destroy();
            });
    });

    it('should pass ResourceManager.loadCss() correct parameters when calling getStyles()', function () {
        var Module = require('../src/module');
        var resourceManagerGetStylesStub = sinon.stub(ResourceManager, 'loadCss').returns(Promise.resolve());
        var module = new Module();
        var styleUrls = ['my/styles'];
        return module.getStyles(styleUrls)
            .then(function () {
                assert.deepEqual(resourceManagerGetStylesStub.args[0][0], styleUrls, 'first parameter passed to getStyles was passed to ResourceManager.loadCss()');
                resourceManagerGetStylesStub.restore();
                module.destroy();
            });
    });

    it('should add module disabled css class when when disable() is called', function () {
        var Module = require('../src/module');
        var el = document.createElement('div');
        var module = new Module({el: el});
        return module.disable()
            .then(function () {
                assert.ok(el.classList.contains('module-disabled'));
                module.destroy();
            });
    });

    it('should call onDisable() when disable() is called', function () {
        var Module = require('../src/module');
        var module = new Module();
        var onDisableSpy = sinon.spy(module, 'onDisable');
        return module.disable()
            .then(function () {
                assert.deepEqual(onDisableSpy.callCount, 1, 'onDisable() was called');
                module.destroy();
                onDisableSpy.restore();
            });
    });

    it('disable() method should still return a promise even if onDisable() custom implementation doesnt', function () {
        var Module = require('../src/module');
        var onDisableStub = sinon.stub().returns(null);
        var CustomModule = Module.extend({onDisable: onDisableStub});
        var module = new CustomModule();
        return module.disable()
            .then(function () {
                assert.equal(onDisableStub.callCount, 1, 'test passed if this is called');
                module.destroy();
            });
    });

    it('should remove module disabled css class when enable() is called after disabled()', function () {
        var Module = require('../src/module');
        var el = document.createElement('div');
        var module = new Module({el: el});
        return module.disable().then(function () {
            return module.enable().then(function () {
                assert.ok(!el.classList.contains('module-disabled'));
                module.destroy();
            });
        });
    });

    it('should call disable() immediately if element has module disabled css class applied before instantiation', function () {
        var Module = require('../src/module');
        var el = document.createElement('div');
        var disableSpy = sinon.spy(Module.prototype, 'disable');
        el.classList.add('module-disabled');
        var module = new Module({el: el});
        assert.equal(disableSpy.callCount, 1);
        module.destroy();
        disableSpy.restore();
    });

    it('should call onEnable() when enable() is called', function () {
        var Module = require('../src/module');
        var module = new Module();
        var onEnableSpy = sinon.spy(module, 'onEnable');
        return module.enable()
            .then(function () {
                assert.deepEqual(onEnableSpy.callCount, 1, 'onEnable() was called');
                module.destroy();
                onEnableSpy.restore();
            });
    });

    it('enable() method should still return a promise even if onEnable() custom implementation doesnt', function () {
        var Module = require('../src/module');
        var onEnableStub = sinon.stub().returns(null);
        var CustomModule = Module.extend({onEnable: onEnableStub});
        var module = new CustomModule();
        return module.enable()
            .then(function () {
                assert.equal(onEnableStub.callCount, 1, 'test passed if this is called');
                module.destroy();
            });
    });

    it('should add module loaded to el passed through load() call', function () {
        var Module = require('../src/module');
        var onLoadStub = sinon.stub(Module.prototype, 'onLoad').returns(Promise.resolve());
        var module = new Module();
        var el = document.createElement('div');
        return module.load({el: el})
            .then(function () {
                assert.ok(el.classList.contains('module-loaded'), 'on load() module loaded class was added');
                module.destroy();
                onLoadStub.restore();
            });
    });

    it('should add module loaded class to el passed through initialize options over a different el passed to the load() call', function () {
        var Module = require('../src/module');
        var onLoadStub = sinon.stub(Module.prototype, 'onLoad').returns(Promise.resolve());
        var initializeEl = document.createElement('div');
        var module = new Module({el: initializeEl});
        var loadEl = document.createElement('div');
        return module.load({el: loadEl})
            .then(function () {
                assert.ok(initializeEl.classList.contains('module-loaded'), 'module loaded class was added to initialize el');
                assert.ok(!loadEl.classList.contains('module-loaded'), 'module loaded class was NOT added to el passed in to load call');
                module.destroy();
                onLoadStub.restore();
            });
    });

    it('active boolean should return true when show() is called', function () {
        var Module = require('../src/module');
        var module = new Module();
        module.show();
        assert.equal(module.active, true);
        module.destroy();
    });

    it('active boolean should return false when hide() is called, after show()', function () {
        var Module = require('../src/module');
        var module = new Module();
        module.show();
        module.hide();
        assert.equal(module.active, false);
        module.destroy();
    });

    it('active boolean should return false when destroy() is called, after show()', function () {
        var Module = require('../src/module');
        var module = new Module();
        module.show();
        module.destroy();
        assert.equal(module.active, false);
    });

    it('active boolean should return false when initialized()', function () {
        var Module = require('../src/module');
        var module = new Module();
        assert.equal(module.active, false);
        module.destroy();
    });

    it('loaded boolean should return true after successful loaded()', function () {
        var Module = require('../src/module');
        var module = new Module();
        module.load().then(function () {
            module.destroy();
            assert.equal(module.loaded, false);
        });
    });

    it('loaded boolean should return false when destroy() is called after load()', function () {
        var Module = require('../src/module');
        var module = new Module();
        module.load();
        module.destroy();
        assert.equal(module.loaded, false);
    });

    it('should resolve error() promise with first parameter passed to it', function () {
        var Module = require('../src/module');
        var el = document.createElement('div');
        var module = new Module({el: el});
        var testErrorObj = {details: 'my error'};
        return module.error(testErrorObj).then(function (err) {
            assert.deepEqual(testErrorObj, err);
            module.destroy();
        });
    });

    it('should resolve error() promise with the first parameter passed to it when onError() resolves without returning an error object', function () {
        var Module = require('../src/module');
        var onErrorStub = sinon.stub(Module.prototype, 'onError').returns(Promise.resolve());
        var el = document.createElement('div');
        var module = new Module({el: el});
        var testErrorObj = {details: 'my passed error'};
        return module.error(testErrorObj).then(function (err) {
            assert.deepEqual(testErrorObj, err);
            module.destroy();
            onErrorStub.restore();
        });
    });

    it('should resolve error() promise with custom error of onError()', function () {
        var Module = require('../src/module');
        var testErrorObj = {details: 'my passed error'};
        var onErrorStub = sinon.stub(Module.prototype, 'onError').returns(Promise.resolve(testErrorObj));
        var el = document.createElement('div');
        var module = new Module({el: el});
        return module.error().then(function (err) {
            assert.deepEqual(testErrorObj, err);
            module.destroy();
            onErrorStub.restore();
        });
    });
});