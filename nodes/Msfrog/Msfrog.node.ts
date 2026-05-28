import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

type MsfrogResource = 'workflow' | 'company' | 'user';
type MsfrogOperation = 'getAll' | 'getSelf';

export class Msfrog implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MSFrog',
		name: 'msfrog',
		icon: { light: 'file:../../icons/msfrog.svg', dark: 'file:../../icons/msfrog.dark.svg' },
		group: ['transform'],
		version: [1, 2],
		defaultVersion: 2,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Access the MSFrog API',
		defaults: {
			name: 'MSFrog',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'msfrogApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: 'http://host.docker.internal:8000',
				placeholder: 'https://example.com',
				description: 'Base URL for the MSFrog API without a trailing slash',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'company',
				options: [
					{ name: 'Company', value: 'company' },
					{ name: 'User', value: 'user' },
					{ name: 'Workflow', value: 'workflow' },
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getAll',
				displayOptions: {
					show: {
						resource: ['workflow'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many workflows',
						description: 'Get many workflows',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getAll',
				displayOptions: {
					show: {
						resource: ['company'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many companies',
						description: 'Get many companies',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getSelf',
				displayOptions: {
					show: {
						resource: ['user'],
					},
				},
				options: [
					{
						name: 'Get Self',
						value: 'getSelf',
						action: 'Get current user details',
						description: 'Get the currently authenticated user',
					},
				],
			},
			{
				displayName: 'Company UUID',
				name: 'companyUuid',
				type: 'string',
				default: '',
				placeholder: 'Optional company UUID',
				description: 'Optional company filter for workflow queries',
				displayOptions: {
					show: {
						resource: ['workflow'],
						operation: ['getAll'],
					},
				},
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: true,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: {
					show: {
						operation: ['getAll'],
						resource: ['workflow', 'company'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						operation: ['getAll'],
						resource: ['workflow', 'company'],
						returnAll: [false],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputItems = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const nodeVersion = this.getNode().typeVersion;

		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as MsfrogResource;
				const operation = this.getNodeParameter('operation', itemIndex) as MsfrogOperation;
				const baseUrl = this.getNodeParameter('baseUrl', itemIndex) as string;
				const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

				const requestJson = async <T>(path: string): Promise<T> => {
					const options: IHttpRequestOptions = {
						method: 'GET',
						url: `${normalizedBaseUrl}${path}`,
						json: true,
					};

					return this.helpers.httpRequestWithAuthentication.call(this, 'msfrogApi', options) as Promise<T>;
				};

				if (nodeVersion >= 2 && resource === 'workflow' && operation === 'getAll') {
					const companyUuid = this.getNodeParameter('companyUuid', itemIndex, '') as string;
					const returnAll = this.getNodeParameter('returnAll', itemIndex, true) as boolean;
					const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
					const path = companyUuid ? `/api/workflows/company/${companyUuid}` : '/api/workflows';
					const workflows = await requestJson<IDataObject[]>(path);
					const selected = returnAll ? workflows : workflows.slice(0, limit);

					for (const workflow of selected) {
						returnData.push({ json: workflow, pairedItem: { item: itemIndex } });
					}

					continue;
				}

				if (nodeVersion >= 2 && resource === 'company' && operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', itemIndex, true) as boolean;
					const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
					const companies = await requestJson<IDataObject[]>('/api/company/getcompanysimpledetails');
					const selected = returnAll ? companies : companies.slice(0, limit);

					for (const company of selected) {
						returnData.push({ json: company, pairedItem: { item: itemIndex } });
					}

					continue;
				}

				if (nodeVersion >= 2 && resource === 'user' && operation === 'getSelf') {
					const user = await requestJson<IDataObject>('/api/user/self');
					returnData.push({ json: user, pairedItem: { item: itemIndex } });
					continue;
				}

				if (nodeVersion < 2 && resource === 'workflow' && operation === 'getAll') {
					const companyUuid = this.getNodeParameter('companyUuid', itemIndex, '') as string;
					const returnAll = this.getNodeParameter('returnAll', itemIndex, true) as boolean;
					const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
					const path = companyUuid ? `/api/workflows/company/${companyUuid}` : '/api/workflows';
					const workflows = await requestJson<IDataObject[]>(path);
					const selected = returnAll ? workflows : workflows.slice(0, limit);

					for (const workflow of selected) {
						returnData.push({ json: workflow, pairedItem: { item: itemIndex } });
					}

					continue;
				}

				if (nodeVersion < 2 && resource === 'company' && operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', itemIndex, true) as boolean;
					const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
					const companies = await requestJson<IDataObject[]>('/api/company/getcompanysimpledetails');
					const selected = returnAll ? companies : companies.slice(0, limit);

					for (const company of selected) {
						returnData.push({ json: company, pairedItem: { item: itemIndex } });
					}

					continue;
				}

				if (nodeVersion < 2 && resource === 'user' && operation === 'getSelf') {
					const user = await requestJson<IDataObject>('/api/user/self');
					returnData.push({ json: user, pairedItem: { item: itemIndex } });
					continue;
				}

				throw new NodeOperationError(this.getNode(), new Error(`Unsupported combination: ${resource}.${operation}`), {
					itemIndex,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
