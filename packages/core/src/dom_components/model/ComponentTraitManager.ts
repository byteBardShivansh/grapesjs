// packages/core/src/dom_components/model/ComponentTraitManager.ts
import { isArray, isFunction } from 'underscore';
import { AddOptions } from '../../common';
import Trait from '../../trait_manager/model/Trait';
import Traits from '../../trait_manager/model/Traits';
import { TraitProperties } from '../../trait_manager/types';
import Component from './Component';

export default class ComponentTraitManager {
  component: Component;

  constructor(component: Component) {
    this.component = component;
    this.__loadTraits();
  }

  __loadTraits(tr?: Traits | TraitProperties[], opts = {}) {
    let traitsI = tr || this.component.traits;

    if (!(traitsI instanceof Traits)) {
      traitsI = (isFunction(traitsI) ? traitsI(this.component) : traitsI) as TraitProperties[];
      const traits = new Traits([], this.component.opt as any);
      traits.setTarget(this.component);

      if (traitsI.length) {
        traits.add(traitsI);
      }

      this.component.set({ traits }, opts);
    }

    return this;
  }

  /**
   * Get traits.
   */
  getTraits(): Trait[] {
    this.__loadTraits();
    return [...this.component.traits.models];
  }

  /**
   * Get the trait by id/name.
   */
  getTrait(id: string): Trait | null {
    return (
      this.getTraits().filter((trait) => {
        return trait.get('id') === id || trait.get('name') === id;
      })[0] || null
    );
  }

  /**
   * Add new trait/s.
   */
  addTrait(trait: Parameters<Traits['add']>[0], opts: AddOptions = {}): Trait | Trait[] {
    this.__loadTraits();
    const added = this.component.traits.add(trait, opts);
    this.component.em?.trigger('component:toggled');
    return isArray(added) ? added : [added];
  }

  /**
   * Remove trait/s by id/s.
   */
  removeTrait(id: string | string[]): Trait | Trait[] {
    const ids = isArray(id) ? id : [id];
    const toRemove = ids.map((id) => this.getTrait(id));
    const { traits } = this.component;
    const removed = toRemove.length ? traits.remove(toRemove) : [];
    this.component.em?.trigger('component:toggled');
    return isArray(removed) ? removed : [removed];
  }
}
