<script>
	import Keypad from './Keypad.svelte';
	import Taskview from './Taskview.svelte';

	export let name;

	let gameStarted = false;

	function startGame() {
		gameStarted = true;
	}

</script>

<style>
	h1 {
		color: purple;
	}
</style>

<h1>Hello {name}!</h1>
{#if !gameStarted}
	<button on:click={startGame}>Hier drücken zum Starten</button>
{:else}
	<Taskview />
	<Keypad />
{/if}
