#include<iostream>
#n
#include<vector>
using namespace std;

void dijkstra(int source , int n , vector<vector<pair<int, int>>> &graph){
    // to store the distance and node so that we can get the minimum distance node at the top of the priority queue
    priority_queue<pair<int,int>, vector<pair<int,int>> , greater<pair<int,int>>> pq;

    // to store the distance of each node from the source node
    vector<int> dist(n,INT_MAX);

    dist[source] = 0;

    // distance , node
    pq.push({0,source});

    while(!pq.empty()){
        int node = pq.top().second;
        int dis = pq.top().first;
        pq.pop();
         
        for(auto it : graph[node]){
            int adjNode = it.first;
            int weight = it.second;

            if(dis + weight < dist[adjNode]){
                dist[adjNode] = dis + weight;
                pq.push({dist[adjNode],adjNode});
            }
        }
    }
}

int main()
{
    int n = 5; // Number of nodes
    vector<vector<pair<int, int>>> graph(n);

    // Add edges (u -> v with weight w)
    graph[0].push_back({1, 2});
    graph[0].push_back({2, 4});
    graph[1].push_back({2, 1});
    graph[1].push_back({3, 7});
    graph[2].push_back({4, 3});
    graph[3].push_back({4, 1});

    int source = 0;
    dijkstra(source, n, graph);

    return 0;
}
