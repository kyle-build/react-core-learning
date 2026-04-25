const App = {
    type: 'div',
    props: {
        id: 'app',
        style: 'background-color: red;height:100px;width:100px',
        children:[
            {
                type:"TEXT_ELEMENT",
                props:{
                    text:"test"
                }
            }
        ]
    }
}

// const App = <div id="app" style="background-color: red;height:100px;width:100px">test</div>
export default App;