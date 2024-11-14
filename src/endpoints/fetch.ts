import { contentJson } from "../contentTypes";
import { NotFoundException } from "../exceptions";
import { OpenAPIRoute } from "../route";
import type { FilterCondition, ListFilters, Meta, O } from "./types";

export class FetchEndpoint<
	HandleArgs extends Array<object> = Array<object>,
> extends OpenAPIRoute<HandleArgs> {
	get meta(): Meta {
		throw new Error("get Meta not implemented");
	}

	getSchema() {
		if (
			this.meta.model.primaryKeys.sort().toString() !==
			this.params.urlParams.sort().toString()
		) {
			throw Error(
				`Model primaryKeys differ from urlParameters on: ${this.params.route}: ${JSON.stringify(this.meta.model.primaryKeys)} !== ${JSON.stringify(this.params.urlParams)}`,
			);
		}

		//const queryParameters = this.model.omit((this.primaryKey || []).reduce((a, v) => ({ ...a, [v]: true }), {}));
		const pathParameters = this.meta.fields.pick(
			(this.meta.model.primaryKeys || []).reduce(
				(a, v) => ({ ...a, [v]: true }),
				{},
			),
		);

		return {
			request: {
				//query: queryParameters,
				params: pathParameters,
				...this.schema?.request,
			},
			responses: {
				"200": {
					description: "Returns a single object if found",
					...contentJson({
						success: Boolean,
						result: this.meta.model.serializerObject,
					}),
					...this.schema?.responses?.[200],
				},
				...NotFoundException.schema(),
				...this.schema?.responses,
			},
			...this.schema,
		};
	}

	async getFilters(): Promise<ListFilters> {
		const data = await this.getValidatedData();

		const filters: Array<FilterCondition> = [];

		for (const part of [data.params, data.query]) {
			if (part) {
				for (const [key, value] of Object.entries(part)) {
					filters.push({
						field: key,
						operator: "EQ",
						value: value as string,
					});
				}
			}
		}

		return {
			filters: filters,
			options: {}, // TODO: make a new type for this
		};
	}

	async before(filters: ListFilters): Promise<ListFilters> {
		return filters;
	}

	async after(data: O<typeof this.meta>): Promise<O<typeof this.meta>> {
		return data;
	}

	async fetch(filters: ListFilters): Promise<O<typeof this.meta> | null> {
		return null;
	}

	async handle(...args: HandleArgs) {
		let filters = await this.getFilters();

		filters = await this.before(filters);

		let obj = await this.fetch(filters);

		if (!obj) {
			throw new NotFoundException();
		}

		obj = await this.after(obj);

		return {
			success: true,
			result: this.meta.model.serializer(obj),
		};
	}
}
