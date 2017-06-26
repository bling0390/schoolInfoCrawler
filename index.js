var Crawler = require('crawler');
var Xlsx = require('node-xlsx');
var fs = require('fs');

var url = 'http://www.gdhed.edu.cn/gsmpro/web/gdschool/gdschool_list.jsp';
var city = [],
    city_duplicate = [], 
    schoolType = [], 
    schoolType_duplicate = [], 
    data = [], 
    currentType, 
    currentCity, 
    totalPage = 1, 
    stage = 0, 
    callbackStage = 'getCityInfo',
    hasTableHead = false;

var crawler = new Crawler ({
    ratelimit: 2000,
    maxConnections: 1,
    callback: function(error, res, done) {
        if (error) {
            console.log(error);
        } else {
            var $ = res.$;
            if (callbackStage === 'getCityInfo') {
                // 收集城市数据
                $('.left_con_b ul li').each(function () {
                    city.push($(this).text().trim());
                });

                //  收集学校类型
                $('#type').children().each(function (index) {
                    if (index !== 0) {
                        schoolType.push($(this).text());
                    }
                });
                city_duplicate = [].concat(city);
                schoolType_duplicate = [].concat(schoolType);
                stage = 1;
            } else if (callbackStage === 'getTotalPage') {
                totalPage = $('#totalPages').val();
                stage = 2;
            } else if (callbackStage === 'getResult') {
                // 获取结果列表信息
                $('table tr').each(function() {
                    var row = [];
                    if ($(this).children().get(0).tagName !== 'th' || hasTableHead !== true) {
                        $(this).children().each(function() {
                            row.push($(this).text());
                        });
                        hasTableHead = true;
                        data.push(row);   
                    }
                });
                stage = 3;
            }
            done();
        }
    }
});

crawler.on('drain',function(){
    // stage === 0 do nothing

    if (stage === 1) { // 获取某城市某学校类型总页码
        callbackStage = 'getTotalPage';
        getTotalPage();
    }

    if (stage === 2) { // 请求每页数据
        callbackStage = 'getResult';
        hasTableHead = false;
        for (var i = 1; i <= totalPage; i ++) {
            crawler.queue(encodeURI(url + '?type=' + currentType + '&city=' + currentCity + '&curPage=' + i));
        }
    }

    if (stage === 3) { // 扒取完某一类目的所有数据, 转为excel文件
        if (data.length !== 0) {
            var buffer = Xlsx.build([{name: currentCity + '-' + currentType, data: data}]); // Returns a buffer
            // fs.writeFileSync(currentCity, buffer);
            fs.writeFile(currentCity + '-' + currentType + '.xlsx', buffer, (err) => {
                if (err) throw err;
                console.log('write file: ' + currentCity + '-' + currentType);
            });
            data = []; // 清空原有
        }
        if (schoolType.length !== 0) {
            callbackStage = 'getTotalPage';
            getTotalPage();
        } else {
            city.splice(0, 1);
            if (city.length !== 0 ) { // 继续扒取下一个城市的结果
                schoolType = [].concat(schoolType_duplicate);
                callbackStage = 'getTotalPage';
                getTotalPage();
            }
        }
    }
});

function getTotalPage() {
    var temp = schoolType.splice(0, 1);
    currentType = temp[0];
    if (currentType) {
        currentCity = city[0];
        crawler.queue(encodeURI(url + '?type=' + currentType + '&city=' + currentCity));
    }
}

crawler.queue(url);
