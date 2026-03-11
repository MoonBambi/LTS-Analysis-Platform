'use strict';
var dashboardKpis = window.dashboardKpis || {};
// [ world-low chart ] start
(function () {
    var mapEl = document.querySelector("#world-low");
    if (mapEl && window.jsVectorMap) {
        new jsVectorMap({
            selector: "#world-low",
            map: "world",
            markersSelectable: true,
            markers: [{
                    coords: [-14.2350, -51.9253]
                },
                {
                    coords: [35.8617, 104.1954]
                },
                {
                    coords: [61, 105]
                },
                {
                    coords: [26.8206, 30.8025]
                }
            ],
            markerStyle: {
                initial: {
                    fill: '#3f4d67',

                },
                hover: {
                    fill: '#04a9f5',
                },
            },
            markerLabelStyle: {
                initial: {
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    fill: '#3f4d67',
                },
            },
        });
    }
})();
// [ world-low chart ] end

// [ Widget-line-chart ] start
var bimonthLabels = ["01-02", "03-04", "05-06", "07-08", "09-10", "11-12"];
var yearToBimonth = dashboardKpis && dashboardKpis.sentiment_by_year_bimonth && typeof dashboardKpis.sentiment_by_year_bimonth === 'object' ? dashboardKpis.sentiment_by_year_bimonth : {};
var availableYears = Array.isArray(dashboardKpis.sentiment_years) ? dashboardKpis.sentiment_years.map(function (y) { return String(y); }) : Object.keys(yearToBimonth);
availableYears = availableYears
    .filter(function (y) { return y; })
    .sort(function (a, b) { return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0); });

var currentYearIndex = -1;
if (availableYears.length) {
    var defaultYearStr = dashboardKpis && dashboardKpis.default_sentiment_year != null ? String(dashboardKpis.default_sentiment_year) : availableYears[availableYears.length - 1];
    currentYearIndex = availableYears.indexOf(defaultYearStr);
    if (currentYearIndex < 0) {
        currentYearIndex = availableYears.length - 1;
    }
}

function getRawSeriesByYear(yearStr) {
    var raw = yearToBimonth && yearStr && yearToBimonth[yearStr];
    if (!Array.isArray(raw)) {
        return [null, null, null, null, null, null];
    }
    if (raw.length >= 6) {
        return raw.slice(0, 6);
    }
    var filled = raw.slice(0);
    while (filled.length < 6) {
        filled.push(null);
    }
    return filled;
}

function seriesToPercent(rawArr) {
    return rawArr.map(function (v) {
        if (typeof v !== 'number') {
            return null;
        }
        return Math.max(0, Math.min(100, Math.round(v * 100)));
    });
}

function avgPercent(rawArr) {
    var sum = 0;
    var cnt = 0;
    for (var i = 0; i < rawArr.length; i += 1) {
        if (typeof rawArr[i] === 'number') {
            sum += rawArr[i];
            cnt += 1;
        }
    }
    if (!cnt) {
        return null;
    }
    return Math.max(0, Math.min(100, Math.round((sum / cnt) * 100)));
}

var initialYear = currentYearIndex >= 0 ? availableYears[currentYearIndex] : null;
var initialRaw = initialYear ? getRawSeriesByYear(initialYear) : [null, null, null, null, null, null];
var initialSeries = seriesToPercent(initialRaw);
var options = {
    chart: {
        type: 'line',
        height: 210,
        zoom: {
            enabled: false
        },
        toolbar: {
            show: false,
        },
    },
    dataLabels: {
        enabled: false,
    },
    colors: ["#fff"],
    fill: {
        type: 'solid',
    },
    legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '12px',
        labels: {
            colors: ["#fff"]
        },
        formatter: function () {
            var yearStr = currentYearIndex >= 0 ? availableYears[currentYearIndex] : '';
            var rawArr = yearStr ? getRawSeriesByYear(yearStr) : [null, null, null, null, null, null];
            var overallPct = avgPercent(rawArr);
            if (typeof overallPct !== 'number') {
                return yearStr ? (yearStr + ' 平均分') : '平均分';
            }
            return (yearStr ? (yearStr + ' 平均分 ') : '平均分 ') + overallPct + '%';
        }
    },
    plotOptions: {
        bar: {
            columnWidth: '30%',
        }
    },
    series: [{
        name: 'Sentiment',
        data: initialSeries
    }],
    xaxis: {
        categories: bimonthLabels,
        axisBorder: {
            show: false,
        },
        axisTicks: {
            show: false,
        },
        labels: {
            style: {
                colors: "#fff"
            }
        },
    },
    yaxis: {
        axisBorder: {
            show: false,
        },
        axisTicks: {
            show: false,
        },
        crosshairs: {
            width: 0
        },
        labels: {
            show: false,
        },
    },
    grid: {
        padding: {
            bottom: 0,
            left: 10,
        },
        xaxis: {
            lines: {
                show: false
            }
        },
        yaxis: {
            lines: {
                show: false
            }
        },
    },
    markers: {
        size: 5,
        colors: '#fff',
        opacity: 0.9,
        strokeWidth: 2,
        hover: {
            size: 7,
        }
    },
    tooltip: {
        fixed: {
            enabled: false
        },
        x: {
            show: false
        },
        y: {
            title: {
                formatter: function (seriesName) {
                    return 'Statistics :'
                }
            }
        },
        marker: {
            show: false
        }
    }
};
var widgetChart = new ApexCharts(document.querySelector("#Widget-line-chart"), options);
widgetChart.render();

(function () {
    var yearLabelEl = document.getElementById('sentiment-year-label');
    var yearAvgEl = document.getElementById('sentiment-year-avg');
    var prevBtn = document.getElementById('sentiment-year-prev');
    var nextBtn = document.getElementById('sentiment-year-next');

    function updateButtons() {
        if (!prevBtn || !nextBtn) {
            return;
        }
        prevBtn.disabled = !(currentYearIndex > 0);
        nextBtn.disabled = !(currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1);
    }

    function renderYear() {
        var yearStr = currentYearIndex >= 0 ? availableYears[currentYearIndex] : null;
        if (yearLabelEl) {
            yearLabelEl.textContent = yearStr || '-';
        }
        updateButtons();
        if (!yearStr) {
            if (yearAvgEl) {
                yearAvgEl.textContent = '-';
            }
            widgetChart.updateSeries([{
                    name: 'Sentiment',
                    data: [null, null, null, null, null, null]
                }]);
            widgetChart.updateOptions({
                legend: options.legend
            }, false, true);
            return;
        }

        var rawArr = getRawSeriesByYear(yearStr);
        var overallPct = avgPercent(rawArr);
        if (yearAvgEl) {
            yearAvgEl.textContent = (typeof overallPct === 'number') ? (yearStr + ' 年平均得分：' + overallPct + '%') : (yearStr + ' 年平均得分：-');
        }
        var percentSeries = seriesToPercent(rawArr);
        widgetChart.updateSeries([{
                name: 'Sentiment',
                data: percentSeries
            }]);
        widgetChart.updateOptions({
            legend: options.legend
        }, false, true);
    }

    renderYear();

    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            if (currentYearIndex > 0) {
                currentYearIndex -= 1;
                renderYear();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            if (currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1) {
                currentYearIndex += 1;
                renderYear();
            }
        });
    }
})();
// [ Widget-line-chart ] end

(function () {
    var heatmapEl = document.getElementById('sentiment-heatmap');
    if (!heatmapEl) {
        return;
    }
    if (!window.echarts) {
        heatmapEl.textContent = 'ECharts 未加载';
        return;
    }

    var years = availableYears.slice(0);
    if (!years.length) {
        heatmapEl.textContent = '暂无数据';
        return;
    }

    var heatmapData = [];
    var maxVal = 0;

    for (var y = 0; y < years.length; y += 1) {
        var yearStr = years[y];
        var rawArr = getRawSeriesByYear(yearStr);
        for (var x = 0; x < bimonthLabels.length; x += 1) {
            var v = rawArr[x];
            if (typeof v === 'number') {
                var pct = Math.max(0, Math.min(100, Math.round(v * 100)));
                heatmapData.push([x, y, pct]);
                if (pct > maxVal) {
                    maxVal = pct;
                }
            } else {
                heatmapData.push([x, y, '-']);
            }
        }
    }

    if (maxVal < 1) {
        maxVal = 100;
    }

    var heatmapChart = echarts.init(heatmapEl);
    heatmapChart.setOption({
        tooltip: {
            position: 'top',
            formatter: function (params) {
                var yearLabel = years[params.data[1]] || '';
                var xLabel = bimonthLabels[params.data[0]] || '';
                var val = params.data[2];
                return yearLabel + ' ' + xLabel + '<br/>' + (val === '-' ? '-' : (val + '%'));
            }
        },
        grid: {
            top: 10,
            left: 60,
            right: 20,
            bottom: 40,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: bimonthLabels,
            splitArea: {
                show: true
            }
        },
        yAxis: {
            type: 'category',
            data: years,
            splitArea: {
                show: true
            }
        },
        visualMap: {
            min: 0,
            max: maxVal,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 0
        },
        series: [{
                name: '情感得分',
                type: 'heatmap',
                data: heatmapData,
                label: {
                    show: true,
                    formatter: function (p) {
                        return p.data[2] === '-' ? '' : p.data[2];
                    }
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.35)'
                    }
                }
            }]
    });

    window.addEventListener('resize', function () {
        heatmapChart.resize();
    });
})();

(function () {
    var kpis = dashboardKpis;

    var totalNewsEl = document.querySelector("#kpi-total-news-area");
    if (totalNewsEl && window.ApexCharts) {
        var seriesData = Array.isArray(kpis.news_last_7_days) ? kpis.news_last_7_days : [];
        var totalNewsOptions = {
            chart: {
                type: 'area',
                height: 120,
                sparkline: {
                    enabled: true
                },
                toolbar: {
                    show: false
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 0.5,
                    opacityFrom: 0.6,
                    opacityTo: 0.05,
                    stops: [0, 90, 100]
                }
            },
            dataLabels: {
                enabled: false
            },
            colors: ['#04a9f5'],
            series: [{
                name: 'Total News',
                data: seriesData
            }],
            tooltip: {
                x: {
                    show: false
                }
            }
        };
        new ApexCharts(totalNewsEl, totalNewsOptions).render();
    }

    var sentimentEl = document.querySelector("#kpi-sentiment-gauge");
    if (sentimentEl && window.ApexCharts) {
        var sentiment = typeof kpis.global_sentiment === 'number' ? kpis.global_sentiment : 0;
        var sentimentPct = Math.max(0, Math.min(100, Math.round(sentiment * 100)));
        var gaugeColor = sentimentPct >= 60 ? '#2ed8b6' : (sentimentPct >= 40 ? '#ffa21d' : '#ff5370');

        var gaugeOptions = {
            chart: {
                type: 'radialBar',
                height: 120,
                sparkline: {
                    enabled: true
                }
            },
            series: [sentimentPct],
            colors: [gaugeColor],
            plotOptions: {
                radialBar: {
                    hollow: {
                        size: '60%'
                    },
                    track: {
                        background: '#f3f5f7'
                    },
                    dataLabels: {
                        name: {
                            show: false
                        },
                        value: {
                            show: true,
                            fontSize: '18px',
                            fontWeight: 600,
                            offsetY: 6,
                            formatter: function (val) {
                                return Math.round(val) + '%';
                            }
                        }
                    }
                }
            }
        };
        new ApexCharts(sentimentEl, gaugeOptions).render();
    }

    var hotTopicsEl = document.querySelector("#kpi-hot-topics-bar");
    if (hotTopicsEl && window.ApexCharts) {
        var topics = Array.isArray(kpis.hot_topics) ? kpis.hot_topics : [];
        var labels = topics.slice(0, 3).map(function (t) { return t.keyword; });
        var counts = topics.slice(0, 3).map(function (t) { return t.count; });

        var hotTopicsOptions = {
            chart: {
                type: 'bar',
                height: 120,
                toolbar: {
                    show: false
                }
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: '55%',
                    borderRadius: 4
                }
            },
            dataLabels: {
                enabled: false
            },
            grid: {
                show: false
            },
            xaxis: {
                categories: labels,
                labels: {
                    show: false
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    style: {
                        fontSize: '12px'
                    }
                }
            },
            colors: ['#3f4d67'],
            series: [{
                name: 'Count',
                data: counts
            }],
            tooltip: {
                y: {
                    formatter: function (val) {
                        return val + ' 次';
                    }
                }
            }
        };
        new ApexCharts(hotTopicsEl, hotTopicsOptions).render();
    }
})();
