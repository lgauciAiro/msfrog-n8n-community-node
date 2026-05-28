import type {
	Icon,
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WisoFrogApi implements ICredentialType {
	name = 'wisoFrogApi';

	displayName = 'Wiso Frog API';

	documentationUrl = 'https://bitbucket.org/airomt/wiso-n8n';

	icon: Icon = { light: 'file:../icons/wiso.svg', dark: 'file:../icons/wiso.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://host.docker.internal:8000',
			description: 'Base URL of the Wiso API',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Bearer token used for API requests',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/user/self',
			method: 'GET',
		},
	};
}
