declare module "*.vue" {
	import type { DefineComponent } from "vue";
	// biome-ignore lint/complexity/noBannedTypes: Vue type definition requires empty object types
	// biome-ignore lint/suspicious/noExplicitAny: Vue type definition requires any
	const component: DefineComponent<{}, {}, any>;
	export default component;
}
