function awiModelSelect( provider, value ) {
	var customInput = document.getElementById( 'awi_' + provider + '_model_custom' );
	if ( ! customInput ) {
		return;
	}
	if ( value === 'custom' ) {
		customInput.style.display = '';
		customInput.focus();
	} else {
		customInput.style.display = 'none';
		customInput.value = value;
	}
}
