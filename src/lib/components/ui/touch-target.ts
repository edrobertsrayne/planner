// On touch (pointer: coarse) a control keeps its drawn size but gets a 44 px hit area, from an
// invisible ::after that is at least 44 px square and centred on the control.
export const touchTarget =
	'pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-full pointer-coarse:after:min-h-11 pointer-coarse:after:w-full pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-1/2';
