import day from 'dayjs';
import { insertAt } from '@/utils/array';
import { ADD_SIDECAR, _FLAGGED, MODE, _STAGE } from '@/config/query-params';
import { escapeHtml } from '@/utils/string';
import { DATE_FORMAT, TIME_FORMAT } from '@/store/prefs';
import { addParams } from '@/utils/url';
import { PRIVATE } from '@/plugins/norman/resource-proxy';

const EMPTY = {};

export default {
  app() {
    const spec = this.spec || EMPTY;
    const status = this.status || EMPTY;
    const metadata = this.metadata || EMPTY;

    return spec.app || status.computedApp || metadata.name;
  },

  version() {
    const spec = this.spec || EMPTY;
    const status = this.status || EMPTY;
    const uid = ((this.metadata || EMPTY)['uid'] || '').replace(/-.*$/, '');

    return spec.version || status.computedVersion || uid || '?';
  },

  nameDisplay() {
    const version = this.version;

    if ( version === 'v0' ) {
      return this.app;
    }

    return `${ this.app }@${ this.version }`;
  },

  namespaceNameDisplay() {
    const namespace = this.metadata.namespace;
    const name = this.metadata.name || this.id;

    return `${ namespace }:${ name }`;
  },

  namespaceApp() {
    return `${ this.metadata.namespace }:${ this.app }`;
  },

  imageDisplay() {
    if ( this.spec.build && !this.spec.image ) {
      return 'Building from Git...';
    }

    return (this.spec.image || '')
      .replace(/^(index\.)?docker.io\/(library\/)?/i, '')
      .replace(/@sha256:[0-9a-f]+$/i, '')
      .replace(/:latest$/i, '')
      .replace(/localhost:5442\/(.*)/i, '$1 (local)');
  },

  createdDisplay() {
    const dateFormat = escapeHtml( this.$rootGetters['prefs/get'](DATE_FORMAT));
    const timeFormat = escapeHtml( this.$rootGetters['prefs/get'](TIME_FORMAT));

    return day(this.metadata.creationTimestamp).format(`${ dateFormat } ${ timeFormat }`);
  },

  versionWithDateDisplay() {
    return `${ this.version } (${ this.createdDisplay })`;
  },

  scales() {
    const status = this.status || {};
    const scaleStatus = status.scaleStatus || {};
    const auto = !!this.spec.autoscale;
    const fixed = (typeof this.spec.replicas === 'undefined' ? 1 : this.spec.replicas || 0);
    const available = scaleStatus.available || 0;
    const current = (typeof status.computedReplicas === 'undefined' ? available : status.computedReplicas || 0);
    const unavailable = scaleStatus.unavailable || 0;
    const global = this.spec.global === true;

    let desired = fixed;
    let min, max;

    if ( auto ) {
      min = this.spec.autoscale.minReplicas;
      max = this.spec.autoscale.maxReplicas;
      desired = `${ min } - ${ max }`;
    }

    if ( global ) {
      desired = current;
    } else if ( typeof this[PRIVATE].pendingScale === 'number' ) {
      desired = this[PRIVATE].pendingScale;
    }

    const missing = Math.max(0, desired - available - unavailable);

    return {
      global,
      auto,
      min,
      max,
      current,
      desired,
      available,
      unavailable,
      starting:    missing > 0 ? missing : 0,
      stopping:    missing < 0 ? -1 * missing : 0,
    };
  },

  showDesiredScale() {
    const scales = this.scales;

    return !scales.global && scales.current !== scales.desired;
  },

  complexScale() {
    const { stopping, starting, unavailable } = this.scales;

    return stopping !== 0 || starting !== 0 || unavailable !== 0;
  },

  scaleParts() {
    const {
      available, unavailable, starting, stopping
    } = this.scales;
    const out = [
      {
        label:     'Available',
        color:     'bg-success',
        textColor: 'text-success',
        value:      available
      },

      {
        label:     'Unavailable',
        color:     'bg-error',
        textColor: 'text-error',
        value:     unavailable
      },
    ];

    if ( starting ) {
      out.push({
        label:     'Starting',
        color:     'bg-info',
        textColor: 'text-info',
        value:     starting
      });
    }

    if ( stopping ) {
      out.push({
        label:     'Stopping',
        color:     'bg-warning',
        textColor: 'text-warning',
        value:     stopping
      });
    }

    return out;
  },

  scaleUp() {
    return () => {
      let scale;

      if ( this.scales.global ) {
        return;
      }

      if ( this[PRIVATE].scaleTimer ) {
        scale = this[PRIVATE].pendingScale;
      } else {
        scale = this.scales.desired;
      }

      scale = scale || 0;

      this[PRIVATE].pendingScale = scale + 1;
      this.saveScale();
    };
  },

  scaleDown() {
    return () => {
      let scale;

      if ( this.scales.global ) {
        return;
      }

      if ( this[PRIVATE].scaleTimer ) {
        scale = this[PRIVATE].pendingScale;
      } else {
        scale = this.scales.desired;
      }

      scale = scale || 1;

      this[PRIVATE].pendingScale = Math.max(scale - 1, 0);
      this.saveScale();
    };
  },

  saveScale() {
    return () => {
      if ( this[PRIVATE].scaleTimer ) {
        clearTimeout(this[PRIVATE].scaleTimer);
      }

      this[PRIVATE].scaleTimer = setTimeout(async() => {
        try {
          await this.patch([{
            op:    'replace',
            path:  '/spec/replicas',
            value: this[PRIVATE].pendingScale
          }]);
        } catch (err) {
          this.$dispatch('growl/fromError', { title: 'Error updating scale', err }, { root: true });
        }

        this[PRIVATE].scaleTimer = null;
        this[PRIVATE].pendingScale = null;
      }, 500);
    };
  },

  saveWeight() {
    return async(neu) => {
      try {
        await this.patch([{
          op:    'replace',
          path:  '/spec/weight',
          value: neu
        }]);
      } catch (err) {
        this.$dispatch('growl/fromError', { title: 'Error updating weight', err }, { root: true });
      }
    };
  },

  weights() {
    let current = 0;
    let desired = 0;
    const spec = this.spec.weight;

    if ( !this.status ) {
      return { current, desired };
    }

    const status = this.status.computedWeight;

    if ( typeof status === 'number' ) {
      current = status;
    } else if ( typeof spec === 'number' ) {
      current = spec;
    }

    if ( typeof spec === 'number' ) {
      desired = spec;
    } else if ( typeof status === 'number' ) {
      desired = status;
    }

    return { current, desired };
  },

  async pauseOrResume(pause = true) {
    try {
      await this.patch({
        op:    'replace',
        path:  '/spec/rollout/pause',
        value: pause
      });
    } catch (err) {
      this.$dispatch('growl/fromError', { title: 'Error updating pause', err }, { root: true });
    }
  },

  pause() {
    return this.pauseOrResume(true);
  },

  resume() {
    return this.pauseOrResume(false);
  },

  goToStage() {
    const router = this.currentRouter();

    return (moreQuery = {}) => {
      const url = addParams(this.detailUrl, {
        [MODE]:  _STAGE,
        ...moreQuery
      });

      router.push({ path: url });
    };
  },

  _availableActions() {
    const links = this.links || {};
    const out = this._standardActions;

    let isPaused = false;

    if ( this.spec.rollout && this.spec.rollout.pause ) {
      isPaused = true;
    }

    insertAt(out, 2, {
      action:  'pause',
      label:   'Pause Rollout',
      icon:    'icon icon-gear',
      enabled:  !!links.update && !isPaused,
    });

    insertAt(out, 2, {
      action:  'resume',
      label:   'Resume Rollout',
      icon:    'icon icon-gear',
      enabled:  !!links.update && isPaused,
    });

    insertAt(out, 2, {
      action:  'addSidecar',
      label:   'Add a Sidecar',
      icon:    'icon icon-circle-plus',
      enabled:  !!links.update,
    });

    insertAt(out, 2, {
      action:  'goToStage',
      label:   'Stage New Version',
      icon:    'icon icon-copy',
      enabled:  !!links.update,
    });

    insertAt(out, 2, { divider: true });

    return out;
  },

  addSidecar() {
    return () => {
      return this.goToEdit({ [ADD_SIDECAR]: _FLAGGED });
    };
  },
};
