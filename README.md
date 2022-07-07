# auto-logging 
#### INITIAL COMMIT COMING SOON 
A tool that automates where and what to log to speed up and boost troubleshooting!

## Auto-Logging and Log Coverage
Let's jump straight into a practical explanation of the problem and a probable solution

### The state today
The code in the figure below represents a simple function that sends messages to a Kafka topic. The code is logically well-covered but has not implemented logging practices. When the service containing this function is deployed, if an error occurs in this function, there is almost no possibility of tracking down the reason for it. The developer needs to spend a long cycle of debugging (assuming the code is part of a large microservices-based architecture), which involves improving the logging, searching, checking manually set rules, etc.

![i](https://user-images.githubusercontent.com/22328259/177746383-72ddd2d8-1f42-4345-bd91-5bbd1aae68fe.png)


### Your Auto-Logger
The code below represents, how the auto-logging AI tool generates the logging statements for the developer. The developer does not need to think about the logging, they focus only coding that produces business value. In the example, the first log line(in red) is not needed, while the next three (in green) need to added for a proper logging to be ensured.

![i1](https://user-images.githubusercontent.com/22328259/177746405-37acb3f1-031b-4441-bc38-c4fb326f4228.png)

Moreover, the tool summarizes the insights/recommends/changes in a report that provides the general log coverage as well as other useful KPIs.
The technology behind is a mixture of Abstract Syntax Trees for code parsing, feature engineering with Deep Neural Networks, and wrappers around to make everything easy to use. The tool could be well integrated into your favorite IDE and CI/CD frameworks.

![i2](https://user-images.githubusercontent.com/22328259/177746432-4bb93580-c145-47ea-ac6c-3655399cd170.png)


### Get notified when Beta version is released!
If this sounds interesting to you, **star** the project and you will be notified once is ready.
