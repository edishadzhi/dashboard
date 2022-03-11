import {
  AGE, NAME, RAM, SIMPLE_NAME, STATE
} from '@/config/table-headers';
import { DSL } from '@/store/type-map';
import { createEpinioRoute, rootEpinioRoute } from '@/products/epinio/utils/custom-routing';
import { EPINIO_PRODUCT_NAME, EPINIO_STANDALONE_CLUSTER_NAME, EPINIO_TYPES } from '@/products/epinio/types';
import EpinioDiscovery from '@/products/epinio/utils/epinio-discovery';
import { MULTI_CLUSTER } from '@/store/features';

export function init(store) {
  const {
    product,
    basicType,
    headers,
    configureType,
    componentForType,
    spoofedType,
    weightType
  } = DSL(store, EPINIO_PRODUCT_NAME);

  const isEpinioSingleProduct = process.env.rancherEnv === 'epinio';

  if (isEpinioSingleProduct) {
    store.dispatch('setIsSingleProduct', {
      logo:                require(`@/products/epinio/assets/logo-epinio.svg`),
      productNameKey:      'epinio.label',
      afterLoginRoute:     createEpinioRoute('c-cluster-applications', { cluster: EPINIO_STANDALONE_CLUSTER_NAME }),
      logoRoute:           createEpinioRoute('c-cluster-applications', { cluster: EPINIO_STANDALONE_CLUSTER_NAME }),
      disableSteveSockets: true,
    });
  }

  product({
    // ifHaveType:          CAPI.RANCHER_CLUSTER,
    ifFeature:             MULTI_CLUSTER,
    category:              EPINIO_PRODUCT_NAME,
    isMultiClusterApp:     true,
    inStore:               EPINIO_PRODUCT_NAME,
    icon:                  'epinio',
    iconHeader:            isEpinioSingleProduct ? undefined : require(`@/products/epinio/assets/logo-epinio.svg`),
    removable:             false,
    showClusterSwitcher:   false,
    to:                    rootEpinioRoute(),
    showNamespaceFilter:   true,
    customNamespaceFilter: true,
  });

  // Internal Types
  spoofedType({
    label:             store.getters['type-map/labelFor']({ id: EPINIO_TYPES.INSTANCE }, 2),
    type:              EPINIO_TYPES.INSTANCE,
    product:           EPINIO_PRODUCT_NAME,
    collectionMethods: [],
    schemas:           [
      {
        id:                EPINIO_TYPES.INSTANCE,
        type:              'schema',
        collectionMethods: [],
        resourceFields:    {},
      }
    ],
    getInstances: async() => await EpinioDiscovery.discover(store),
  });
  configureType(EPINIO_TYPES.INSTANCE, {
    isCreatable:          false,
    isEditable:           false,
    isRemovable:          false,
    showState:            false,
    showAge:              false,
    canYaml:              false,
  });
  configureType(EPINIO_TYPES.INSTANCE, { customRoute: createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.INSTANCE }) });
  componentForType(EPINIO_TYPES.APP_ACTION, undefined, EPINIO_PRODUCT_NAME);

  // App resource
  weightType(EPINIO_TYPES.APP, 300, true);
  componentForType(EPINIO_TYPES.APP, undefined, EPINIO_PRODUCT_NAME);
  configureType(EPINIO_TYPES.APP, {
    isCreatable:          true,
    isEditable:           true,
    isRemovable:          true,
    showState:            true,
    showAge:              false,
    canYaml:              false,
    customRoute:          createEpinioRoute('c-cluster-applications', { }),
  });

  // Configuration resource
  weightType(EPINIO_TYPES.CONFIGURATION, 200, true);
  componentForType(EPINIO_TYPES.CONFIGURATION, undefined, EPINIO_PRODUCT_NAME);
  configureType(EPINIO_TYPES.CONFIGURATION, {
    isCreatable: true,
    isEditable:  true,
    isRemovable: true,
    showState:   false,
    showAge:     false,
    canYaml:     false,
    customRoute: createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.CONFIGURATION }),
  });

  // Namespace resource
  weightType(EPINIO_TYPES.NAMESPACE, 100, true);
  componentForType(EPINIO_TYPES.NAMESPACE, undefined, EPINIO_PRODUCT_NAME);
  configureType(EPINIO_TYPES.NAMESPACE, {
    isCreatable:      true,
    isEditable:       true,
    isRemovable:      true,
    showState:        false,
    showAge:          false,
    canYaml:          false,
    customRoute:      createEpinioRoute('c-cluster-resource', { resource: EPINIO_TYPES.NAMESPACE }),
    showListMasthead: false // Disable default masthead because we provide a custom one.
  });

  basicType([
    EPINIO_TYPES.APP,
    EPINIO_TYPES.NAMESPACE,
    EPINIO_TYPES.CONFIGURATION
  ]);

  headers(EPINIO_TYPES.APP, [
    STATE,
    NAME,
    {
      name:          'namespace',
      labelKey:      'epinio.tableHeaders.namespace',
      value:         'meta.namespace',
      sort:          ['meta.namespace'],
      formatter:     'LinkDetail',
      formatterOpts: { reference: 'nsLocation' }
    },
    {
      name:     'dep-status',
      labelKey: 'tableHeaders.status',
      value:    'deployment.status',
      sort:     ['deployment.status'],
    },
    {
      name:      'route',
      labelKey:  'epinio.applications.tableHeaders.route',
      search:      ['configuration.route'],
    },
    {
      name:      'configurations',
      labelKey:  'epinio.applications.tableHeaders.boundConfigs',
      search:    ['configuration.configurations'],
    },
    {
      name:     'deployedBy',
      labelKey: 'epinio.applications.tableHeaders.deployedBy',
      value:    'deployment.username',
      sort:     ['deployment.username'],
    }
  ]);

  const { width, canBeVariable, ...instanceName } = SIMPLE_NAME;

  headers(EPINIO_TYPES.APP_INSTANCE, [
    STATE,
    instanceName,
    {
      name:          'millicpus',
      label:         'Milli CPUs',
      value:         'millicpus',
      sort:          ['millicpus'],
      search:        false,
    },
    {
      ...RAM,
      sort:          ['memoryBytes'],
      search:        false,
      value:         'memoryBytes',
      formatter:     'Si',
    },
    {
      name:      'restarts',
      label:     'Restarts',
      value:     'restarts',
      sort:      ['restarts'],
    },
    {
      ...AGE,
      value:     'createdAt',
      sort:      'createdAt:desc',
    }
  ]);

  headers(EPINIO_TYPES.NAMESPACE, [
    SIMPLE_NAME,
    {
      name:      'applications',
      labelKey:  'epinio.namespace.tableHeaders.appCount',
      value:     'appCount',
      sort:      ['appCount'],
    },
    {
      name:      'configurations',
      labelKey:  'epinio.namespace.tableHeaders.configCount',
      value:     'configCount',
      sort:      ['configCount'],
    },
  ]);

  headers(EPINIO_TYPES.INSTANCE, [
    STATE,
    {
      name:          'name',
      labelKey:      'tableHeaders.simpleName',
      sort:     ['name'],
    },
    {
      name:      'api',
      labelKey:  'epinio.instances.tableHeaders.api',
      sort:      ['api'],
    },
  ]);

  headers(EPINIO_TYPES.CONFIGURATION, [
    NAME,
    {
      name:          'namespace',
      labelKey:      'epinio.tableHeaders.namespace',
      value:         'meta.namespace',
      sort:          ['meta.namespace'],
      formatter:     'LinkDetail',
      formatterOpts: { reference: 'nsLocation' }
    },
    {
      name:      'boundApps',
      labelKey:  'epinio.configurations.tableHeaders.boundApps',
      search:    ['configuration.boundapps'],
    },
    {
      name:      'count',
      labelKey:  'epinio.configurations.tableHeaders.variableCount',
      value:     'variableCount',
      sort:      ['variableCount'],
    },
    {
      name:      'createdBy',
      labelKey:  'epinio.configurations.tableHeaders.createBy',
      value:     'configuration.user',
      sort:      ['configuration.user'],
    },
  ]);
}