这是一个浏览器插件项目，目的是，进行一些tab的快捷跳转
这个快捷键是 window+j+j 

实操效果举例子

1. 按下快捷键，弹出一个文本框，输入loop，如果配置中，输入的value，没有配置，那就寻找当前窗口所有的tabs，使用 includes 的方式筛选符合要求的tabs url(不含参数和hash)，显示在下拉框中
2. 如果配置中设置了 key: loop, value: www.loop.com ，下拉框优先展示这个网站，然后是当前 tabs 里面的其他符合要求的网站 


