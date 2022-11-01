var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.52.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function email(value) {
        if (/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(value)) {
            return null;
        }
        return { email: {} };
    }

    /* webviews/components/sidebar.svelte generated by Svelte v3.52.0 */
    const file = "webviews/components/sidebar.svelte";

    // (110:0) {#if showLogin==true && showLogin!=null}
    function create_if_block_1(ctx) {
    	let form;
    	let div0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div1;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let div2;
    	let input2;
    	let t6;
    	let label2;
    	let t8;
    	let button;
    	let t10;
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "E-Mail";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Password";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			div2 = element("div");
    			input2 = element("input");
    			t6 = space();
    			label2 = element("label");
    			label2.textContent = "Show Password";
    			t8 = space();
    			button = element("button");
    			button.textContent = "Login";
    			t10 = space();
    			a = element("a");
    			a.textContent = "New to logsight.ai?";
    			attr_dev(label0, "class", "form__group__label svelte-1m2a6h4");
    			attr_dev(label0, "for", "emailAddress");
    			add_location(label0, file, 113, 2, 2282);
    			attr_dev(input0, "class", "form__group__input svelte-1m2a6h4");
    			attr_dev(input0, "type", "email");
    			attr_dev(input0, "id", "emailAddress");
    			input0.required = true;
    			add_location(input0, file, 114, 2, 2352);
    			attr_dev(div0, "class", "form__group svelte-1m2a6h4");
    			add_location(div0, file, 112, 1, 2254);
    			attr_dev(label1, "class", "form__group__label svelte-1m2a6h4");
    			attr_dev(label1, "for", "password");
    			add_location(label1, file, 117, 2, 2522);
    			attr_dev(input1, "class", "form__group__input svelte-1m2a6h4");
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "id", "password");
    			input1.required = true;
    			add_location(input1, file, 118, 2, 2590);
    			attr_dev(div1, "class", "form__group svelte-1m2a6h4");
    			add_location(div1, file, 116, 1, 2494);
    			attr_dev(input2, "class", "form__group__checkbox svelte-1m2a6h4");
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "id", "showPassword");
    			add_location(input2, file, 121, 2, 2770);
    			attr_dev(label2, "class", "form__group__label svelte-1m2a6h4");
    			attr_dev(label2, "for", "showPassword");
    			add_location(label2, file, 122, 2, 2873);
    			attr_dev(div2, "class", "form__group form__group--check svelte-1m2a6h4");
    			add_location(div2, file, 120, 1, 2723);
    			attr_dev(button, "type", "submit");
    			add_location(button, file, 124, 1, 2957);
    			attr_dev(form, "class", "form");
    			add_location(form, file, 111, 0, 2198);
    			attr_dev(a, "href", "https://logsight.ai/auth/register");
    			add_location(a, file, 127, 0, 3003);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			/*input0_binding*/ ctx[8](input0);
    			set_input_value(input0, /*emailAddress*/ ctx[1]);
    			append_dev(form, t2);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t4);
    			append_dev(div1, input1);
    			/*input1_binding*/ ctx[10](input1);
    			set_input_value(input1, /*password*/ ctx[3]);
    			append_dev(form, t5);
    			append_dev(form, div2);
    			append_dev(div2, input2);
    			append_dev(div2, t6);
    			append_dev(div2, label2);
    			append_dev(form, t8);
    			append_dev(form, button);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[11]),
    					listen_dev(input2, "change", /*handleOnChange*/ ctx[7], false, false, false),
    					listen_dev(form, "submit", prevent_default(/*doLogin*/ ctx[5]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*emailAddress*/ 2 && input0.value !== /*emailAddress*/ ctx[1]) {
    				set_input_value(input0, /*emailAddress*/ ctx[1]);
    			}

    			if (dirty & /*password*/ 8 && input1.value !== /*password*/ ctx[3]) {
    				set_input_value(input1, /*password*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			/*input0_binding*/ ctx[8](null);
    			/*input1_binding*/ ctx[10](null);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(a);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(110:0) {#if showLogin==true && showLogin!=null}",
    		ctx
    	});

    	return block;
    }

    // (131:0) {#if showLogin==false && showLogin!=null}
    function create_if_block(ctx) {
    	let form;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			button = element("button");
    			button.textContent = "Logout";
    			attr_dev(button, "type", "submit");
    			add_location(button, file, 132, 1, 3177);
    			attr_dev(form, "class", "form");
    			add_location(form, file, 131, 0, 3120);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", prevent_default(/*doLogout*/ ctx[6]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(131:0) {#if showLogin==false && showLogin!=null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let img;
    	let img_src_value;
    	let t0;
    	let t1;
    	let t2;
    	let div;
    	let a;
    	let if_block0 = /*showLogin*/ ctx[0] == true && /*showLogin*/ ctx[0] != null && create_if_block_1(ctx);
    	let if_block1 = /*showLogin*/ ctx[0] == false && /*showLogin*/ ctx[0] != null && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			img = element("img");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			div = element("div");
    			a = element("a");
    			a.textContent = "Join our [community]";
    			attr_dev(img, "class", "center svelte-1m2a6h4");
    			if (!src_url_equal(img.src, img_src_value = "https://logsight.ai/assets/img/logo-logsight.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "logsight.ai logo");
    			add_location(img, file, 106, 0, 2055);
    			attr_dev(a, "href", "https://github.com/aiops/autologger");
    			add_location(a, file, 137, 0, 3253);
    			attr_dev(div, "class", "row-pt-2");
    			add_location(div, file, 136, 0, 3230);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showLogin*/ ctx[0] == true && /*showLogin*/ ctx[0] != null) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(t1.parentNode, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*showLogin*/ ctx[0] == false && /*showLogin*/ ctx[0] != null) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(t2.parentNode, t2);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			if (detaching) detach_dev(t0);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sidebar', slots, []);
    	let showLogin = true;
    	tsvscode.postMessage({ type: "onGetToken", value: true });
    	let emailAddress = "";
    	let emailAddressInput = null;
    	let password = "";
    	let passwordInput = null;
    	let result = null;

    	onMount(() => {
    		// emailAddressInput.focus();
    		window.addEventListener('message', event => {
    			const message = event.data;

    			switch (message.type) {
    				case "token":
    					if (message.value) {
    						$$invalidate(0, showLogin = false);
    					} else {
    						$$invalidate(0, showLogin = true);
    					}
    					break;
    			}
    		});
    	});

    	async function doLogin() {
    		const res = await fetch("http://localhost:8080/api/v1/auth/login", {
    			method: 'POST',
    			headers: { 'Content-Type': 'application/json' },
    			body: JSON.stringify({ "email": emailAddress, password })
    		});

    		const json = await res.json();
    		result = json.token;
    		tsvscode.postMessage({ type: "onLogin", value: result });
    	}

    	const doLogout = evt => {
    		tsvscode.postMessage({ type: "onLogout", value: true });
    	};

    	const handleOnChange = evt => {
    		// Cannot dynamically update the `type` attribute via a two-way binding to the `type` attribtue.
    		// Error: 'type' attribute cannot be dynamic if input uses two-way binding.
    		passwordInput.setAttribute('type', evt.target.checked ? 'text' : 'password');
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	function input0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			emailAddressInput = $$value;
    			$$invalidate(2, emailAddressInput);
    		});
    	}

    	function input0_input_handler() {
    		emailAddress = this.value;
    		$$invalidate(1, emailAddress);
    	}

    	function input1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			passwordInput = $$value;
    			$$invalidate(4, passwordInput);
    		});
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(3, password);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		email,
    		showLogin,
    		emailAddress,
    		emailAddressInput,
    		password,
    		passwordInput,
    		result,
    		doLogin,
    		doLogout,
    		handleOnChange
    	});

    	$$self.$inject_state = $$props => {
    		if ('showLogin' in $$props) $$invalidate(0, showLogin = $$props.showLogin);
    		if ('emailAddress' in $$props) $$invalidate(1, emailAddress = $$props.emailAddress);
    		if ('emailAddressInput' in $$props) $$invalidate(2, emailAddressInput = $$props.emailAddressInput);
    		if ('password' in $$props) $$invalidate(3, password = $$props.password);
    		if ('passwordInput' in $$props) $$invalidate(4, passwordInput = $$props.passwordInput);
    		if ('result' in $$props) result = $$props.result;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		showLogin,
    		emailAddress,
    		emailAddressInput,
    		password,
    		passwordInput,
    		doLogin,
    		doLogout,
    		handleOnChange,
    		input0_binding,
    		input0_input_handler,
    		input1_binding,
    		input1_input_handler
    	];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new Sidebar({
        target: document.body,
    });

    return app;

})();
//# sourceMappingURL=sidebar.js.map
