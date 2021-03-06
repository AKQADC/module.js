'use strict';

var Promise = require('promise');
var _ = require('underscore');
var $ = require('jquery');
var ResourceManager = require('resource-manager-js');

/**
 * @class Module
 * @description Base class that represents all modules of an App.
 */
var Module = function (options) {
    this.initialize(options);
};

/**
 * Extends a class and allows creation of subclasses.
 * @param protoProps
 * @param staticProps
 * @returns {*}
 */
var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
        child = protoProps.constructor;
    } else {
        child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate();

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) {
        _.extend(child.prototype, protoProps);
    }

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
};

Module.extend = extend;

Module.prototype = {

    /**
     * Initialization.
     * @param {Object} [options] - An object of options
     * @param {HTMLElement} [options.el] - The module element
     * @param {string} [options.loadedClass] - The class that will be applied to the module element when it is loaded
     * @param {string} [options.activeClass] - The class that will be applied to the module element when it is shown
     * @param {string} [options.disabledClass] - The class that will be applied to the module element when disabled
     * @param {string} [options.errorClass] - The class that will be applied to the module element when it has a load error
     */
    initialize: function (options) {

        this.options = _.extend({}, {
            el: null,
            loadedClass: 'module-loaded',
            activeClass: 'module-active',
            disabledClass: 'module-disabled',
            errorClass: 'module-error'
        }, options);

        this._handleElementInitialState();

        this.subModules = {};
        this.active = false;
        this.loaded = false;
    },

    /**
     * A function that fires when the module's load() method is called
     * which can be overridden by subclass custom implementations.
     * @abstract
     * @return {*} May return a promise when done
     * @param options
     */
    onLoad: function (options) {
        return Promise.resolve();
    },

    /**
     * A function that fires when the module's show() method is called
     * which can be overridden by subclass custom implementations.
     * @abstract
     * @return {*} May return a promise when done
     */
    onShow: function () {
        return Promise.resolve();
    },

    /**
     * A function that fires when the module's hide() method is called
     * which can be overridden by subclass custom implementations.
     * @abstract
     * @return {*} May return a promise when done
     */
    onHide: function () {
        return Promise.resolve();
    },

    /**
     * A function that fires when the module's enable() method is called
     * which can be overridden by subclass custom implementations.
     * @abstract
     * @returns {*|Promise} Optionally return a promise when done
     */
    onEnable: function () {
        return Promise.resolve();
    },

    /**
     * A function that fires when the module's disable() method is called
     * which can be overridden by subclass custom implementations.
     * @abstract
     * @returns {*|Promise} Optionally return a promise when done
     */
    onDisable: function () {
        return Promise.resolve();
    },

    /**
     * A function that fires when the error() method is called
     * which can be overridden by subclass custom implementations.
     * @param {Object} [e] - The error object that was triggered
     * @abstract
     * @returns {*} Optionally return a promise when done
     */
    onError: function (e) {
        return Promise.resolve(e);
    },

    /**
     * Loads.
     * @param {Object} [options] - Options
     * @param {HTMLElement} [options.el] - The modules element (used only if module element wasnt passed in initialize)
     * @return {Promise}
     */
    load: function (options) {
        var views = _.values(this.subModules);

        // add element to options
        if (options) {
            this.options.el = this.options.el || options.el;
        }

        // load all subModules
        if (!this.loaded) {
            return Promise.all(_.invoke(views, 'load')).then(function () {
                return this._ensurePromise(this.onLoad(options))
                    .then(function () {
                        this.loaded = true;
                        if (this.options.el) {
                            this.options.el.classList.add(this.options.loadedClass);
                        }
                    }.bind(this))
                    .catch(function (e) {
                        this.error(e);
                        return e;
                    }.bind(this));
            }.bind(this));
        } else {
            return Promise.resolve();
        }
    },

    /**
     * Triggers a load error on the module.
     * @param {Object} [err] - The error object to trigger
     * @return {Promise} Returns a promise when erroring operation is complete
     */
    error: function (err) {
        var el = this.options.el,
            e = err || new Error(),
            msg = e.message || '';

        if (el) {
            el.classList.add(this.options.errorClass);
        }
        this.error = true;
        this.loaded = false;

        console.warn('MODULE ERROR!' + ' ' + msg);

        if (e.stack) {
            console.log(e.stack);
        }
        return this._ensurePromise(this.onError(e))
            .then(function (customErr) {
                return customErr || e;
            });
    },

    /**
     * Enables the module.
     * @return {Promise}
     */
    enable: function () {
        var el = this.options.el;
        if (el) {
            el.classList.remove(this.options.disabledClass);
        }
        this.disabled = false;
        return this._ensurePromise(this.onEnable());
    },

    /**
     * Disables the module.
     * @return {Promise}
     */
    disable: function () {
        var el = this.options.el;
        if (el) {
            el.classList.add(this.options.disabledClass);
        }
        this.disabled = true;
        return this._ensurePromise(this.onDisable());
    },

    /**
     * Shows the page.
     * @return {Promise}
     */
    show: function () {
        var el = this.options.el;
        if (el) {
            el.classList.add(this.options.activeClass);
        }
        this.active = true;
        return this._ensurePromise(this.onShow());
    },

    /**
     * Hides the page.
     * @return {Promise}
     */
    hide: function () {
        var el = this.options.el;
        if (el) {
            el.classList.remove(this.options.activeClass);
        }
        this.active = false;
        return this._ensurePromise(this.onHide());
    },

    /**
     * Sets up element internally by evaluating its initial state.
     * @private
     */
    _handleElementInitialState: function () {
        var el = this.options.el;
        if (!el) {
            return;
        }
        if (el.classList.contains(this.options.disabledClass)) {
            this._origDisabled = true;
            this.disable();
        }

        if (el.classList.contains(this.options.errorClass)) {
            this._origError = true;
            this.error(new Error());
        }
    },

    /**
     * Restores the elements classes back to the way they were before instantiation.
     * @private
     */
    _resetElementInitialState: function () {
        var options = this.options,
            el = options.el,
            disabledClass = options.disabledClass,
            errorClass = options.errorClass;

        if (!el) {
            return;
        }
        if (this._origDisabled) {
            el.classList.add(disabledClass);
        } else {
            el.classList.remove(disabledClass);
        }

        if (!this._origError) {
            el.classList.remove(errorClass);
        } else {
            el.classList.add(errorClass);
        }
    },

    /**
     * Wraps a promise around a function if doesnt already have one.
     * @param func
     * @private
     */
    _ensurePromise: function (func) {
        if (!func || !func.then) {
            func = Promise.resolve();
        }
        return func;
    },

    /**
     * Makes a request to get the data for the module.
     * @param {string} url - The url to fetch data from
     * @param [options] - ajax options
     * @returns {*}
     */
    fetchData: function (url, options) {
        return ResourceManager.fetchData(url, options);
    },

    /**
     * Gets the css files for the module.
     * @param cssUrl
     * @return {Promise}
     */
    getStyles: function (cssUrl) {
        return ResourceManager.loadCss(cssUrl);
    },

    /**
     * Gets the html template for the module.
     * @param templateUrl
     * @returns {Promise|*}
     */
    getTemplate: function (templateUrl) {
        return ResourceManager.loadTemplate(templateUrl);
    },

    /**
     * A function that should overridden that serializes the data for a template.
     * @param data
     * @returns {*}
     */
    serializeData: function (data) {
        return data;
    },

    /**
     * Destroys all nested views and cleans up.
     */
    destroy: function () {
        var subModules = this.subModules;

        for (var key in subModules) {
            if (subModules.hasOwnProperty(key) && subModules[key]) {
                subModules[key].destroy();
            }
        }
        this.subModules = {};
        this.active = false;
        this.loaded = false;

        this._resetElementInitialState();
    }

};


module.exports = Module;