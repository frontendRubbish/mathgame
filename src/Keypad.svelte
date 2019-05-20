<script>
	export let name;
</script>

<style>
	.keypad {
		display: flex;
		flex-wrap: wrap;
		width: 240px;
	}

	.key {
		box-sizing: border-box;
		flex-grow: 1;
		height: 80px;
		margin: 0px;
		width: 80px;
	}

</style>

<div class="keypad">
	<button class="key">1</button>
	<button class="key">2</button>
	<button class="key">3</button>
	<button class="key">4</button>
	<button class="key">5</button>
	<button class="key">6</button>
	<button class="key">7</button>
	<button class="key">8</button>
	<button class="key">9</button>
	<button class="key">0</button>
</div>
