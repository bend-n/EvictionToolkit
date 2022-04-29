// core items
let items = [
    Items.copper,
    Items.lead
];

let itemMeans = new Array(items.length);
let lastValues = new Array(items.length);

let table;
let nestedTable;
let labels = [];

// power
let stored = 0;
let battery = 0.01;
let powerBalance = 0;

let has_loaded = false

let bar;

function add_item(item) {
    items.push(item);
    let mean = new WindowedMean(100 * 60)
    mean.fill(0.0)
    if (mean == undefined) return "how"
    itemMeans.push(mean);
    lastValues.push(0);
    labels.push(nestedTable.labelWrap("").width(180).pad(1).get());
    nestedTable.row();
}

global.uiitems = items
global.add_item = add_item

// Events.on(WorldLoadEvent, event => {
//     Log.info("world lead event")
//     if (!has_loaded) return
//     items = [Items.copper, Items.lead]
//     labels = []
//     for (let i = 0; i < items.length; i++) {
//         labels.push(nestedTable.labelWrap("").width(180).pad(1).get());
//         // nestedTable.row();
//     }
// })

Events.on(ClientLoadEvent, event => {
    /* core items */
    has_loaded = true
    let mean = new WindowedMean(100 * 60)
    mean.fill(0.0)
    print(mean.rawMean())
    Vars.mods.getScripts().runConsole("this.additem = global.add_item");
    for (let i = 0; i < items.length; i++) {
        itemMeans[i] = new WindowedMean(100 * 60);
        itemMeans[i].fill(0.0);
        lastValues[i] = 0;
    }

    table = new Table(Styles.none);
    table.setPosition(10, 700); // extends down
    nestedTable = table.table().margin(3).get();
    table.align(Align.topLeft);

    for (let i = 0; i < items.length; i++) {
        labels.push(nestedTable.labelWrap("").width(180).pad(1).get());
        nestedTable.row();
    }
    table.pack();
    Vars.ui.hudGroup.addChild(table);

    /* power*/
    bar = new Bar("Power: ", Pal.accent, floatp(() => {
        return getBatteryBalance();
    }));
    bar.set(prov(() => {
        return "Power: " + (powerBalance > 0 ? "[#00ff00]+" : "[#ff0000]") + formatNumber(powerBalance * 60.0, true);
    }), floatp(() => {
        return getBatteryBalance();
    }), Pal.accent);
    bar.setPosition(860, 1040);
    bar.setWidth(250);
    bar.setHeight(30);
    Vars.ui.hudGroup.addChild(bar);
    Timer.schedule(() => {
        // look for new items
        let currentItems = Vars.player.team().items();
        // Log.info("checking for new item")
        for (let i = 0; i < all.length; i++) {
            if (!items.includes(all[i])) {
                if (currentItems.get(all[i]) != 0) {
                    add_item(all[i]);
                    Log.info("applyed " + all[i].emoji() + " " + all[i].name)
                }
                // Log.info(all[i].emoji() + all[i].name + " not in core")
            }
            // Log.info(all[i].emoji() + " " + all[i].name + "is in the list")
        }
    }, 3, 3);
});

const all = [
    Items.copper,
    Items.lead,
    Items.graphite,
    Items.silicon,
    Items.metaglass,
    Items.titanium,
    Items.thorium,
    Items.plastanium,
    Items.phaseFabric,
    Items.surgeAlloy,
    Items.coal,
    Items.sand,
    Items.blastCompound,
    Items.pyratite,
    Items.sporePod,
    Items.scrap // eeeh
]



Events.run(Trigger.update, () => {
    // core items
    let currentItems = Vars.player.team().items();



    let latestMin = Number.POSITIVE_INFINITY;
    let latestMax = 0;
    let meanMin = Number.POSITIVE_INFINITY;
    let meanMax = 0;

    let reset = true;
    try {
        for (let i = 0; i < items.length; i++) {
            if (lastValues[i] > 0) reset = false;
            if (itemMeans[i] == undefined) {
                Log.info("stop");
                break
            }
            // Log.info(items[i].emoji() + " " + itemMeans[i].rawMean())
            if (lastValues[i] < latestMin) latestMin = lastValues[i];
            if (lastValues[i] > latestMax) latestMax = lastValues[i];
            if (itemMeans[i].rawMean() < meanMin) meanMin = itemMeans[i].rawMean();
            if (itemMeans[i].rawMean() > meanMax) meanMax = itemMeans[i].rawMean();
        }
    } catch (e) {
        Log.info(e)
    }

    for (let i = 0; i < items.length; i++) {
        let currentValue = currentItems.get(items[i]);

        if (reset) lastValues[i] = currentValue;
        if (itemMeans[i] == undefined) break
        let text = getItemText(i, lastValues[i], latestMin, latestMax, itemMeans[i].rawMean(), meanMin, meanMax);

        labels[i].setText(text);

        itemMeans[i].add(currentValue * 60.0 - lastValues[i] * 60.0);
        lastValues[i] = currentValue;
    }

    // power
    stored = 0;
    battery = 0.01;
    powerBalance = 0;

    let graphs = [];
    let search = (it) => {
        while (it.hasNext()) {
            let tile = it.next();

            if (tile.build && tile.build.power) {
                let graph = tile.build.power.graph;

                if (graphs.indexOf(graph) < 0) {
                    stored += graph.getBatteryStored();
                    if (stored == 0) stored == 1;
                    battery += graph.getTotalBatteryCapacity();
                    powerBalance += graph.getPowerBalance();

                    graphs.push(graph);
                }
            }
        }
    };
    search(Vars.indexer.getAllied(Vars.player.team(), BlockFlag.generator).iterator());
    search(Vars.indexer.getAllied(Vars.player.team(), BlockFlag.battery).iterator());
});

Events.on(ResetEvent, event => {
    for (let i = 0; i < items.length; i++) {
        itemMeans[i].fill(0.0);
    }
});

function getItemText(index, latest, latestMin, latestMax, mean, meanMin, meanMax) {
    let halfLatest = (latestMax - latestMin) / 2 + latestMin;

    let closer = ((mean === 0) ? "[#aaaaaa]" : "[]");

    let latestString = closer + (latest > 0 ? (latest >= halfLatest ? getNormalizedColor(125, 100, latest, halfLatest, latestMax, true) : getNormalizedColor(0, 100, latest, latestMin, halfLatest, false)) : "") +
        formatNumber(latest, true) + closer;

    let meanString = "(" + ((mean === 0) ? closer : (mean > 0 ? getNormalizedColor(125, 100, mean, 0, meanMax, true) + "+" : getNormalizedColor(0, 100, mean, meanMin, 0, false))) +
        formatNumber(mean, false) + closer + ")";

    return items[index].emoji() + " " + latestString + " " + meanString;
}

function getNormalizedColor(h, s, value, min, max, reverse) {
    let norm = Math.round(((value - min) / (max - min)) * 10) / 10;

    if (isNaN(norm)) return "";
    return "[" + HSLToHex(h, s, (reverse ? (1 - norm) : norm) * 50 + 50) + "]";
}

function HSLToHex(h, s, l) {
    // cursed function
    s /= 100;
    l /= 100;

    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c / 2,
        r = 0,
        g = 0,
        b = 0;

    if (0 <= h && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (60 <= h && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (120 <= h && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (180 <= h && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (240 <= h && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (300 <= h && h < 360) {
        r = c;
        g = 0;
        b = x;
    }
    // Having obtained RGB, convert channels to hex
    r = Math.round((r + m) * 255).toString(16);
    g = Math.round((g + m) * 255).toString(16);
    b = Math.round((b + m) * 255).toString(16);

    // Prepend 0s, if necessary
    if (r.length == 1)
        r = "0" + r;
    if (g.length == 1)
        g = "0" + g;
    if (b.length == 1)
        b = "0" + b;

    return "#" + r + g + b;
}


function formatNumber(number, round) {
    let abs = Math.abs(number);
    if (abs >= 10000) {
        return Math.round(number / 1000) + "k";
    } else if (abs >= 1000) {
        return Math.round(number / 100) / 10 + "k";
    } else {
        return round ? Math.round(number) : Math.round(number * 10) / 10;
    }
}

function getBatteryBalance() {
    return stored / battery;
}