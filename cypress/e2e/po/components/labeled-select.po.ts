import ComponentPo from '@/cypress/e2e/po/components/component.po';

export default class LabeledSelectPo extends ComponentPo {
  toggle() {
    return this.self().click();
  }

  clickOption(optionIndex: number) {
    return this.self().get(`.vs__dropdown-menu .vs__dropdown-option:nth-child(${ optionIndex })`).click();
  }
}
