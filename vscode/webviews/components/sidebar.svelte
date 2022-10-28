<script>
	import { onMount } from 'svelte';
    import { email } from 'svelte-use-form';

	let showLogin = true;
	tsvscode.postMessage({
            type: "onGetToken",
            value: true
        })

	let emailAddress = "";
	let emailAddressInput = null;
	
	let password = "";
	let passwordInput = null;
	let result = null;
	onMount(() => {
		// emailAddressInput.focus();
		window.addEventListener('message', (event) => {
			const message = event.data
			switch (message.type){
				case "token":
					if (message.value) {
						showLogin = false;
					}else{
						showLogin = true;
					}
					break;
			}

		});
	});

    async function doLogin () {
		const res = await fetch("http://localhost:8080/api/v1/auth/login", {
			method: 'POST',
            headers: {
            'Content-Type': 'application/json'
            },
			body: JSON.stringify({
			    "email": emailAddress,
				"password": password
			})
		});
		const json = await res.json();
		result = json.token;
        tsvscode.postMessage({
            type: "onLogin",
            value: result
        });
    
	}
    const doLogout = (evt) => {
        tsvscode.postMessage({
            type: "onLogout",
            value: true
        });
	};

	
	const handleOnChange = (evt) => {
		// Cannot dynamically update the `type` attribute via a two-way binding to the `type` attribtue.
		// Error: 'type' attribute cannot be dynamic if input uses two-way binding.
		passwordInput.setAttribute('type', evt.target.checked ? 'text' : 'password' );
	}
</script>

<style>
	.form__group {
		margin-bottom: 0.875rem; 
	}
	
	.form__group__label {
		margin-bottom: 0.5rem;
	}
	
	.form__group__input {
		margin-bottom: 0;
	}
	
	.form__group--check {
		display: flex;
		align-items: center;
	}
	
	.form__group__checkbox {
		margin-bottom: 0;
	}
	
	.form__group--check > .form__group__label {
		margin-bottom: 0;
	}
	
	.form__group--check > .form__group__checkbox {
		margin-right: 0.5rem;
	}
	
	.center {
		display: block;
		margin-left: auto;
		margin-right: auto;
		width: 80%;
	}
</style>


<img class="center" src="https://logsight.ai/assets/img/logo-logsight.svg" alt="logsight.ai logo">


{#if showLogin==true && showLogin!=null}

<form class="form" on:submit|preventDefault={doLogin}>
	<div class="form__group">
		<label class="form__group__label" for="emailAddress">E-Mail</label>
		<input class="form__group__input" type="email" id="emailAddress" bind:this={emailAddressInput} bind:value={emailAddress} required />
	</div>
	<div class="form__group">
		<label class="form__group__label" for="password">Password</label>
		<input class="form__group__input" type="password" id="password" bind:this={passwordInput} bind:value={password} required />
	</div>
	<div class="form__group form__group--check">
		<input class="form__group__checkbox" type="checkbox" id="showPassword" on:change={handleOnChange} />
		<label class="form__group__label" for="showPassword">Show Password</label>
	</div>
	<button type="submit">Login</button>
</form>

<a href="https://logsight.ai/auth/register">New to logsight.ai?</a>
{/if}

{#if showLogin==false && showLogin!=null}
<form class="form" on:submit|preventDefault={doLogout}>
	<button type="submit">Logout</button>
</form>
{/if}