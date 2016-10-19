const createExperimentProvider = require("inject!addon/ExperimentProvider");
const {PrefService} = require("shims/sdk/preferences/service");
const PrefsTarget = require("shims/sdk/preferences/event-target");
const {preferencesBranch} = require("sdk/self");
const PREF_PREFIX = `extensions.${preferencesBranch}.`;

const DEFAULT_OPTIONS = {
  clientID: "foo",
  experiments: {
    foo: {
      name: "Foo Test",
      active: true,
      description: "A test about foo",
      control: {
        value: false,
        description: "Foo is 42 by default"
      },
      variant: {
        id: "foo_01",
        value: true,
        threshold: 0.5,
        description: "Twice the foo"
      }
    }
  }
};

describe("ExperimentProvider", () => {
  let experimentProvider;
  let prefService = new PrefService();

  function setup(options = {}) {
    const {experiments, n} = Object.assign({}, DEFAULT_OPTIONS, options);
    const {ExperimentProvider} = createExperimentProvider({
      "sdk/preferences/service": prefService,
      "sdk/preferences/event-target": PrefsTarget
    });
    experimentProvider = new ExperimentProvider(experiments, n && (() => n));
    experimentProvider.init();
  }

  afterEach(() => {
    experimentProvider.destroy();
    experimentProvider = null;
    prefService.setPrefs({});
  });

  it("should have the right properties", () => {
    setup();
    assert.ok(experimentProvider._rng, "should have a ._rng property");
    assert.ok(experimentProvider._data, "should have a ._data property");
  });
  it("should set .experimentId", () => {
    setup({n: 0.8});
    assert.equal(experimentProvider.experimentId, null, "should be null for control group");
  });
  it("should set .experimentId", () => {
    setup({n: 0.1});
    assert.equal(experimentProvider.experimentId, "foo_01", "should be foo_01 if in experiment");
  });
  it("should set .data ", () => {
    setup({clientID: "baz", n: 0.6});
    assert.equal(experimentProvider.data, experimentProvider._data, ".data should return this._data");
    assert.deepEqual(experimentProvider.data.foo, DEFAULT_OPTIONS.experiments.foo.control.value, "should result in control being picked");
  });
  it("should set .data", () => {
    setup({clientID: "012j", n: 0.3});
    assert.deepEqual(experimentProvider.data.foo, DEFAULT_OPTIONS.experiments.foo.variant.value, "should result in variant being picked");
  });
  it("should throw if experiment cohorts add to > 1", () => {
    assert.throws(() => {
      setup({
        experiments: {
          foo: {
            name: "foo",
            active: true,
            description: "foo",
            control: {value: false, description: "foo"},
            variant: {id: "foo_01", value: true, threshold: 0.5, description: "foo"}
          },
          bar: {
            name: "bar",
            active: true,
            description: "bar",
            control: {value: false, description: "bar"},
            variant: {id: "bar_01", value: true, threshold: 0.6, description: "bar"}
          }
        }
      });
    });
  });
  it("should only select one experiment", () => {
    const randomNumber = 0.2;
    setup({
      clientID: "foo",
      experiments: {
        kitty: {
          name: "kitty",
          active: true,
          control: {value: false},
          variant: {id: "kitty_01", threshold: 0.2, value: true}
        },
        dachshund: {
          name: "dachshund",
          active: true,
          control: {value: false},
          variant: {id: "dachshund_01", threshold: 0.2, value: true}
        }
      },
      n: randomNumber
    });
    assert.equal(experimentProvider.data.dachshund, true, "dachshund should be selected");
    assert.equal(experimentProvider.data.kitty, false, "kitty should not be selected");
    assert.equal(experimentProvider.experimentId, "dachshund_01", "the experimentId should be dachshund_01");
  });
  it("should skip experiments with active:false", () => {
    setup({
      clientID: "foo",
      experiments: {
        foo: {
          active: false,
          name: "foo",
          control: {value: "bloo"},
          variant: {
            id: "asdasd",
            threshold: 0.3,
            value: "blah"
          }
        }
      },
      n: 0.1
    });
    assert.equal(experimentProvider.data.foo, undefined, "foo is not selected");
  });

  describe("overrides", () => {
    it("should override experiments and not set an experimentId", () => {
      setup({n: 0.2});
      assert.equal(experimentProvider.data.foo, true);
      assert.equal(experimentProvider.experimentId, "foo_01");

      prefService.set(`${PREF_PREFIX}foo`, false);
      experimentProvider._onPrefChange();

      assert.equal(experimentProvider.data.foo, DEFAULT_OPTIONS.experiments.foo.control.value);
      assert.equal(experimentProvider.experimentId, null);
    });
    it("should turn on an experiment even if it is active: false", () => {
      setup({n: 0.8});
      assert.equal(experimentProvider.data.foo, false);
      assert.equal(experimentProvider.experimentId, null);

      prefService.set(`${PREF_PREFIX}foo`, true);
      experimentProvider._onPrefChange();

      assert.equal(experimentProvider.data.foo, DEFAULT_OPTIONS.experiments.foo.variant.value);
      assert.equal(experimentProvider.experimentId, null);
    });
    it["should enable a disabled experiment"] = assert => {
      let data = {
        clientID: "foo",
        experiments: {
          kitty: {
            name: "kitty",
            active: false,
            control: {value: false},
            variant: {id: "kitty_01", threshold: 0.2, value: true}
          }
        },
        n: 0.1
      };
      setup(data);
      assert.equal(experimentProvider.data.kitty, undefined);
      assert.equal(experimentProvider.experimentId, null);

      experimentProvider.destroy();
      data.experiments.kitty.active = true;

      setup(data);

      assert.equal(experimentProvider.data.kitty, true);
      assert.equal(experimentProvider.experimentId, "kitty_01");
    };
    it("should override multiple experiments", () => {
      setup({
        experiments: {
          foo: {
            name: "foo",
            active: true,
            description: "foo",
            control: {value: false, description: "foo"},
            variant: {id: "foo_01", value: true, threshold: 0.2, description: "foo"}
          },
          bar: {
            name: "bar",
            active: true,
            description: "bar",
            control: {value: false, description: "bar"},
            variant: {id: "bar_01", value: true, threshold: 0.2, description: "bar"}
          }
        },
        n: 0.4
      });
      assert.equal(experimentProvider.data.foo, false);
      assert.equal(experimentProvider.data.bar, false);

      prefService.set(`${PREF_PREFIX}foo`, true);
      prefService.set(`${PREF_PREFIX}bar`, true);
      experimentProvider._onPrefChange();

      assert.equal(experimentProvider.data.foo, true);
      assert.equal(experimentProvider.data.bar, true);
      assert.equal(experimentProvider.experimentId, null);
    });
    it("should add a pref listener on new, active experiments", () => {
      setup({n: 0.3});
      assert.calledWith(experimentProvider._target.on, `${PREF_PREFIX}foo`);
    });
    it("should remove the pref listener on experiment prefs and reset experimentId", () => {
      setup({n: 0.1});
      experimentProvider.destroy();
      assert.calledWith(experimentProvider._target.off, `${PREF_PREFIX}foo`);
      assert.isNull(experimentProvider.experimentId);
    });
    it("should reset experiments on a pref change", () => {
      setup({
        experiments: {
          foo: {
            name: "foo",
            active: true,
            description: "foo",
            control: {value: false, description: "foo"},
            variant: {id: "foo_01", value: true, threshold: 0.2, description: "foo"}
          }
        }
      });
      assert.isFalse(experimentProvider.data.foo);
      prefService.set(`${PREF_PREFIX}foo`, true);
      experimentProvider._onPrefChange();
      assert.isTrue(experimentProvider.data.foo);
    });
    it("should disable experiment with participating user", () => {
      let data = {
        clientID: "foo",
        experiments: {
          kitty: {
            name: "kitty",
            active: true,
            control: {value: false},
            variant: {id: "kitty_01", threshold: 0.2, value: true}
          }
        },
        n: 0.1
      };
      setup(data);
      assert.equal(experimentProvider.data.kitty, true);
      assert.equal(experimentProvider.experimentId, "kitty_01");

      experimentProvider.destroy();

      assert.equal(experimentProvider.data.kitty, true);
      assert.equal(experimentProvider.experimentId, null);

      data.experiments.kitty.active = false;
      setup(data);

      assert.equal(experimentProvider.data.kitty, false);
      assert.equal(experimentProvider.experimentId, null);

      // Reactivating an experiment that a user was in that became
      // inactive should not re-consider that user.
      data.experiments.kitty.active = true;
      experimentProvider.destroy();
      setup(data);

      assert.equal(experimentProvider.data.kitty, false);
      assert.equal(experimentProvider.experimentId, null);
    });
    it("should make new experiment available", () => {
      let data = {
        clientID: "foo",
        experiments: {
          kitty: {
            name: "kitty",
            active: true,
            control: {value: false},
            variant: {id: "kitty_01", threshold: 0.2, value: true}
          }
        },
        n: 0.3
      };
      setup(data);
      assert.equal(experimentProvider.data.kitty, false);
      assert.equal(experimentProvider.experimentId, null);

      experimentProvider.destroy();
      data.experiments.dachshund = {
        name: "dachshund",
        active: true,
        control: {value: false},
        variant: {id: "dachshund_01", threshold: 0.2, value: true}
      };
      data.n = 0.1;

      setup(data);

      // We weren't in the kitty experiment initally, so we will stay
      // out of it even though our new random number would normally choose kitty.
      assert.equal(experimentProvider.data.kitty, false);
      assert.equal(experimentProvider.data.dachshund, true);
      assert.equal(experimentProvider.experimentId, "dachshund_01");
    });
  });
});
