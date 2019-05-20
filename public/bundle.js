
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
	'use strict';

	function noop() {}

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

	function empty() {
		return text('');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = blank_object();
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	/* src/Keypad.svelte generated by Svelte v3.4.1 */

	const file = "src/Keypad.svelte";

	function create_fragment(ctx) {
		var div, button0, t1, button1, t3, button2, t5, button3, t7, button4, t9, button5, t11, button6, t13, button7, t15, button8, t17, button9;

		return {
			c: function create() {
				div = element("div");
				button0 = element("button");
				button0.textContent = "1";
				t1 = space();
				button1 = element("button");
				button1.textContent = "2";
				t3 = space();
				button2 = element("button");
				button2.textContent = "3";
				t5 = space();
				button3 = element("button");
				button3.textContent = "4";
				t7 = space();
				button4 = element("button");
				button4.textContent = "5";
				t9 = space();
				button5 = element("button");
				button5.textContent = "6";
				t11 = space();
				button6 = element("button");
				button6.textContent = "7";
				t13 = space();
				button7 = element("button");
				button7.textContent = "8";
				t15 = space();
				button8 = element("button");
				button8.textContent = "9";
				t17 = space();
				button9 = element("button");
				button9.textContent = "0";
				button0.className = "key svelte-1ikjb06";
				add_location(button0, file, 22, 1, 245);
				button1.className = "key svelte-1ikjb06";
				add_location(button1, file, 23, 1, 277);
				button2.className = "key svelte-1ikjb06";
				add_location(button2, file, 24, 1, 309);
				button3.className = "key svelte-1ikjb06";
				add_location(button3, file, 25, 1, 341);
				button4.className = "key svelte-1ikjb06";
				add_location(button4, file, 26, 1, 373);
				button5.className = "key svelte-1ikjb06";
				add_location(button5, file, 27, 1, 405);
				button6.className = "key svelte-1ikjb06";
				add_location(button6, file, 28, 1, 437);
				button7.className = "key svelte-1ikjb06";
				add_location(button7, file, 29, 1, 469);
				button8.className = "key svelte-1ikjb06";
				add_location(button8, file, 30, 1, 501);
				button9.className = "key svelte-1ikjb06";
				add_location(button9, file, 31, 1, 533);
				div.className = "keypad svelte-1ikjb06";
				add_location(div, file, 21, 0, 223);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, button0);
				append(div, t1);
				append(div, button1);
				append(div, t3);
				append(div, button2);
				append(div, t5);
				append(div, button3);
				append(div, t7);
				append(div, button4);
				append(div, t9);
				append(div, button5);
				append(div, t11);
				append(div, button6);
				append(div, t13);
				append(div, button7);
				append(div, t15);
				append(div, button8);
				append(div, t17);
				append(div, button9);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let { name } = $$props;

		$$self.$set = $$props => {
			if ('name' in $$props) $$invalidate('name', name = $$props.name);
		};

		return { name };
	}

	class Keypad extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["name"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.name === undefined && !('name' in props)) {
				console.warn("<Keypad> was created without expected prop 'name'");
			}
		}

		get name() {
			throw new Error("<Keypad>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set name(value) {
			throw new Error("<Keypad>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/Taskview.svelte generated by Svelte v3.4.1 */

	const file$1 = "src/Taskview.svelte";

	function create_fragment$1(ctx) {
		var div0, t0, t1, div1, t2, t3, div2, t4;

		return {
			c: function create() {
				div0 = element("div");
				t0 = text(ctx.number1);
				t1 = space();
				div1 = element("div");
				t2 = text(ctx.number2);
				t3 = space();
				div2 = element("div");
				t4 = text(ctx.result);
				div0.className = "number";
				add_location(div0, file$1, 12, 0, 104);
				div1.className = "number";
				add_location(div1, file$1, 15, 0, 142);
				div2.className = "number";
				add_location(div2, file$1, 18, 0, 180);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div0, anchor);
				append(div0, t0);
				insert(target, t1, anchor);
				insert(target, div1, anchor);
				append(div1, t2);
				insert(target, t3, anchor);
				insert(target, div2, anchor);
				append(div2, t4);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div0);
					detach(t1);
					detach(div1);
					detach(t3);
					detach(div2);
				}
			}
		};
	}

	function instance$1($$self) {
		

		let number1,
				number2,
				result;

		return { number1, number2, result };
	}

	class Taskview extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
		}
	}

	/* src/App.svelte generated by Svelte v3.4.1 */

	const file$2 = "src/App.svelte";

	// (24:0) {:else}
	function create_else_block(ctx) {
		var t, current;

		var taskview = new Taskview({ $$inline: true });

		var keypad = new Keypad({ $$inline: true });

		return {
			c: function create() {
				taskview.$$.fragment.c();
				t = space();
				keypad.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(taskview, target, anchor);
				insert(target, t, anchor);
				mount_component(keypad, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				taskview.$$.fragment.i(local);

				keypad.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				taskview.$$.fragment.o(local);
				keypad.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				taskview.$destroy(detaching);

				if (detaching) {
					detach(t);
				}

				keypad.$destroy(detaching);
			}
		};
	}

	// (22:0) {#if !gameStarted}
	function create_if_block(ctx) {
		var button, dispose;

		return {
			c: function create() {
				button = element("button");
				button.textContent = "Hier drücken zum Starten";
				add_location(button, file$2, 22, 1, 286);
				dispose = listen(button, "click", ctx.startGame);
			},

			m: function mount(target, anchor) {
				insert(target, button, anchor);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(button);
				}

				dispose();
			}
		};
	}

	function create_fragment$2(ctx) {
		var h1, t0, t1, t2, t3, current_block_type_index, if_block, if_block_anchor, current;

		var if_block_creators = [
			create_if_block,
			create_else_block
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (!ctx.gameStarted) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				h1 = element("h1");
				t0 = text("Hello ");
				t1 = text(ctx.name);
				t2 = text("!");
				t3 = space();
				if_block.c();
				if_block_anchor = empty();
				h1.className = "svelte-i7qo5m";
				add_location(h1, file$2, 20, 0, 243);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				append(h1, t0);
				append(h1, t1);
				append(h1, t2);
				insert(target, t3, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (!current || changed.name) {
					set_data(t1, ctx.name);
				}

				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t3);
				}

				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		

		let { name } = $$props;

		let gameStarted = false;

		function startGame() {
			$$invalidate('gameStarted', gameStarted = true);
		}

		$$self.$set = $$props => {
			if ('name' in $$props) $$invalidate('name', name = $$props.name);
		};

		return { name, gameStarted, startGame };
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["name"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.name === undefined && !('name' in props)) {
				console.warn("<App> was created without expected prop 'name'");
			}
		}

		get name() {
			throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set name(value) {
			throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const app = new App({
		target: document.body,
		props: {
			name: 'Son'
		}
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
